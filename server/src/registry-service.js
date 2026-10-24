const crypto = require('node:crypto')
const { HttpError } = require('./errors')
const { inTransaction } = require('./database')
const { readRegistryWorkbook, writeRegistryWorkbook } = require('./registry-workbook')

const FIELDS = { college:100, name:50, gender:10, gradeMajor:150, phone:100, dorm:100, counselorInfo:200, studentSupport:1000, leaderSupport:1000, remarks:3000, studentNo:50 }
function monthValue(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) throw new HttpError(422, 'REGISTRY_MONTH_INVALID', '请选择有效的等级年月')
  return String(value)
}
function normalizeRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(422, 'REGISTRY_INVALID', '学生资料格式不正确')
  const record = {}
  for (const [key, limit] of Object.entries(FIELDS)) {
    const value = input[key] == null ? '' : input[key]
    if (typeof value !== 'string') throw new HttpError(422, 'REGISTRY_FIELD_INVALID', '登记字段必须为文本')
    record[key] = value.trim()
    if (record[key].length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(record[key])) throw new HttpError(422, 'REGISTRY_FIELD_INVALID', '登记内容过长或包含无效字符：' + key)
  }
  if (!record.name || !record.college || !record.gradeMajor) throw new HttpError(422, 'REGISTRY_REQUIRED', '学院、姓名、年级专业为必填项')
  record.levels = {}
  const levels = input.levels || {}
  if (typeof levels !== 'object' || Array.isArray(levels) || Object.keys(levels).length > 240) throw new HttpError(422, 'REGISTRY_LEVEL_INVALID', '等级记录格式不正确或超过240个月')
  for (const [month, level] of Object.entries(levels)) {
    monthValue(month)
    if (typeof level !== 'string' || level.trim().length > 40 || /[\u0000-\u001f]/.test(level)) throw new HttpError(422, 'REGISTRY_LEVEL_INVALID', '等级需为40字以内的文本')
    if (level.trim()) record.levels[month] = level.trim()
  }
  return record
}
function similar(a, b) { return a.name === b.name && a.college === b.college && a.gradeMajor === b.gradeMajor }

function createRegistryServices(database, context) {
  const { requireRole, audit, nowIso, dataProtector } = context
  function staff(user) { requireRole(user, ['admin', 'counselor']) }
  function unpack(row) {
    return { ...dataProtector.unprotectJson(row.record_json, 'registry:' + row.id), id:row.id, counselorId:row.counselor_user_id,
      counselorName:row.counselor_name || '', revision:Number(row.revision), createdAt:row.created_at, updatedAt:row.updated_at }
  }
  async function owner(user, requested) {
    staff(user)
    if (user.role === 'counselor' && requested && requested !== user.id) throw new HttpError(403, 'FORBIDDEN', '只能管理自己负责的学生资料')
    const id = user.role === 'counselor' ? user.id : String(requested || '')
    const found = await database.prepare("SELECT id, display_name FROM users WHERE id = ? AND role = 'counselor' AND active = 1").get(id)
    if (!found) throw new HttpError(422, 'REGISTRY_OWNER_REQUIRED', '请选择一位已启用的负责辅导员')
    return found
  }
  async function records(user, filters = {}) {
    staff(user)
    const args = [], clauses = []
    if (user.role === 'counselor') { clauses.push('s.counselor_user_id = ?'); args.push(user.id) }
    else if (filters.counselorId) { clauses.push('s.counselor_user_id = ?'); args.push(String(filters.counselorId)) }
    const rows = await database.prepare(`SELECT s.*, u.display_name AS counselor_name FROM registry_students s JOIN users u ON u.id = s.counselor_user_id ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY s.created_at DESC, s.id`).all(...args)
    const month = filters.month ? monthValue(filters.month) : ''
    const query = String(filters.q || '').trim().toLocaleLowerCase()
    let selectedIds
    if (filters.ids) {
      selectedIds = String(filters.ids).split(',').filter(Boolean)
      if (selectedIds.length > 2000) throw new HttpError(422, 'REGISTRY_SELECTION_INVALID', '每次最多选择2000条档案')
    }
    return rows.map(unpack).filter(r => (!query || [r.name,r.studentNo,r.college,r.gradeMajor,r.dorm,r.phone].some(v => v.toLocaleLowerCase().includes(query))) &&
      (!filters.college || r.college === filters.college) && (!filters.level || (r.levels[month] || '') === filters.level) && (!selectedIds || selectedIds.includes(r.id)))
  }
  async function getRecord(user, id) {
    staff(user)
    const row = await database.prepare('SELECT s.*, u.display_name AS counselor_name FROM registry_students s JOIN users u ON u.id = s.counselor_user_id WHERE s.id = ?').get(id)
    if (!row || (user.role === 'counselor' && row.counselor_user_id !== user.id)) throw new HttpError(404, 'REGISTRY_NOT_FOUND', '档案不存在或无权访问')
    return unpack(row)
  }
  async function duplicateCandidates() {
    return (await database.prepare('SELECT * FROM registry_students').all()).map(unpack)
  }
  async function duplicates(record, excludedId, candidates) {
    // Cross-owner checks return no other counselor's student information to the caller.
    const rows = candidates || await duplicateCandidates()
    let sameNo = false, possible = false
    for (const row of rows) {
      if (row.id === excludedId) continue
      const other = row
      if (record.studentNo && other.studentNo === record.studentNo) sameNo = true
      if ((!record.studentNo || !other.studentNo) && similar(record, other)) possible = true
    }
    return { sameNo, possible }
  }
  async function insert(record, counselorId) {
    const id = crypto.randomUUID(), timestamp = nowIso()
    await database.prepare('INSERT INTO registry_students (id, counselor_user_id, record_json, revision, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)')
      .run(id, counselorId, dataProtector.protectJson(record, 'registry:' + id), timestamp, timestamp)
    return id
  }
  async function saveRecord(user, input, id) {
    staff(user)
    const record = normalizeRecord(input)
    const existing = id ? await getRecord(user, id) : null
    const responsible = existing ? { id:existing.counselorId, display_name:existing.counselorName } : await owner(user, input.counselorId)
    if (!record.counselorInfo) record.counselorInfo = responsible.display_name
    await inTransaction(database, async () => {
      // Serialize duplicate checks and inserts across MySQL application instances.
      if (database.dialect === 'mysql') await database.prepare("SELECT id FROM users WHERE role = 'counselor' ORDER BY id FOR UPDATE").all()
      const match = await duplicates(record, id)
      if (match.sameNo) throw new HttpError(409, 'REGISTRY_DUPLICATE', '该学号已有档案，请核对后编辑已有档案')
      if (match.possible && input.acknowledgeDuplicate !== true) throw new HttpError(409, 'REGISTRY_POSSIBLE_DUPLICATE', '发现同学院、同年级专业的同名学生，请核对并勾选重名确认')
      if (existing) {
        if (!Number.isInteger(input.revision) || input.revision !== existing.revision) throw new HttpError(409, 'REGISTRY_CHANGED', '档案已更新，请重新打开后编辑')
        const result = await database.prepare('UPDATE registry_students SET record_json = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?')
          .run(dataProtector.protectJson(record, 'registry:' + id), nowIso(), id, input.revision)
        if (!result.changes) throw new HttpError(409, 'REGISTRY_CHANGED', '档案已更新，请重新打开后编辑')
      } else id = await insert(record, responsible.id)
      await audit(user.id, existing ? '修改学生登记档案' : '新增学生登记档案', 'registry_student', id, { counselorId:responsible.id })
    })
    return getRecord(user, id)
  }
  async function profile(user, input) {
    requireRole(user, 'counselor')
    if (input !== undefined) {
      const displayName = String(input.displayName || '').trim(), contact = String(input.contact || '').trim(), college = String(input.college || '').trim()
      if (Object.keys(input).some(k => !['displayName','contact','college'].includes(k)) || !displayName || displayName.length > 50 || contact.length > 100 || college.length > 100 || /[\u0000-\u001f\u007f]/.test(displayName + contact + college)) throw new HttpError(422, 'PROFILE_INVALID', '请填写有效的姓名、联系方式和学院')
      await inTransaction(database, async () => {
        await database.prepare('UPDATE users SET display_name = ?, profile_completed = 1 WHERE id = ?').run(displayName, user.id)
        const found = await database.prepare('SELECT user_id FROM counselor_profiles WHERE user_id = ?').get(user.id)
        if (found) await database.prepare('UPDATE counselor_profiles SET contact = ?, college = ?, updated_at = ? WHERE user_id = ?').run(contact,college,nowIso(),user.id)
        else await database.prepare('INSERT INTO counselor_profiles (user_id, contact, college, updated_at) VALUES (?, ?, ?, ?)').run(user.id,contact,college,nowIso())
        await audit(user.id, '维护辅导员个人资料', 'user', user.id, {})
      })
    }
    const userRow = await database.prepare('SELECT display_name FROM users WHERE id = ?').get(user.id)
    const row = await database.prepare('SELECT contact, college FROM counselor_profiles WHERE user_id = ?').get(user.id)
    return { displayName:userRow.display_name, contact:row?.contact || '', college:row?.college || '' }
  }
  async function preview(user, buffer, input) {
    const responsible = await owner(user, input.counselorId)
    const month = monthValue(input.month)
    const parsed = await readRegistryWorkbook(buffer, month)
    const candidates = await duplicateCandidates()
    const rows = [], seenNos = new Set(), seenRows = new Set()
    for (const entry of parsed.rows) {
      const issues = [], warnings = []
      let record = { ...entry.record, counselorInfo:entry.record.counselorInfo || responsible.display_name }
      try { record = normalizeRecord(record) } catch (error) { issues.push(error.message) }
      if (!issues.length) {
        const fingerprint = JSON.stringify(record)
        if (seenRows.has(fingerprint)) issues.push('文件内存在完全重复的学生行')
        seenRows.add(fingerprint)
        if (record.studentNo && seenNos.has(record.studentNo)) issues.push('文件内学号重复')
        if (record.studentNo) seenNos.add(record.studentNo)
        const match = await duplicates(record, null, candidates)
        if (match.sameNo) issues.push('该学号已有登记档案')
        if (match.possible || rows.some(r => !r.issues.length && similar(r.record, record) && (!r.record.studentNo || !record.studentNo))) warnings.push('存在同学院、同年级专业的同名学生，请核对')
      }
      rows.push({ rowNumber:entry.rowNumber, record, issues, warnings })
    }
    const id = crypto.randomUUID(), timestamp = nowIso()
    await database.prepare("DELETE FROM registry_imports WHERE status = 'preview' AND expires_at < ?").run(timestamp)
    const result = { id, month, counselorId:responsible.id, counselorName:responsible.display_name, sheetName:parsed.sheetName, rows, total:rows.length,
      invalid:rows.filter(r => r.issues.length).length, warnings:rows.filter(r => r.warnings.length).length,
      expiresAt:new Date(Date.parse(timestamp) + 15 * 60 * 1000).toISOString() }
    await database.prepare('INSERT INTO registry_imports (id, actor_user_id, counselor_user_id, preview_json, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, user.id, responsible.id, dataProtector.protectJson(result, 'registry-import:' + id), 'preview', timestamp, result.expiresAt)
    await audit(user.id, '预检学生登记表', 'registry_import', id, { rows:rows.length, invalid:result.invalid })
    return result
  }
  async function confirm(user, id, input = {}) {
    staff(user)
    return inTransaction(database, async () => {
      if (database.dialect === 'mysql') await database.prepare("SELECT id FROM users WHERE role = 'counselor' ORDER BY id FOR UPDATE").all()
      const row = await database.prepare('SELECT * FROM registry_imports WHERE id = ?' + (database.dialect === 'mysql' ? ' FOR UPDATE' : '')).get(id)
      if (!row || row.actor_user_id !== user.id) throw new HttpError(404, 'IMPORT_NOT_FOUND', '导入预览不存在或无权访问')
      if (row.status === 'committed') return JSON.parse(row.result_json)
      if (Date.parse(row.expires_at) < Date.parse(nowIso())) throw new HttpError(410, 'IMPORT_EXPIRED', '预览已过期，请重新上传')
      await owner(user, row.counselor_user_id)
      const batch = dataProtector.unprotectJson(row.preview_json, 'registry-import:' + id)
      if (batch.invalid) throw new HttpError(422, 'IMPORT_INVALID', '请修正错误行并重新上传后再导入')
      if (batch.warnings && input.acknowledgeDuplicates !== true) throw new HttpError(409, 'IMPORT_DUPLICATES', '请核对重名提示并确认')
      const ids = []
      const candidates = await duplicateCandidates()
      for (const entry of batch.rows) {
        const match = await duplicates(entry.record, null, candidates)
        if (match.sameNo || (match.possible && input.acknowledgeDuplicates !== true)) throw new HttpError(409, 'IMPORT_DATA_CHANGED', '已有档案发生变化或出现重复，请重新上传预检')
        ids.push(await insert(entry.record, row.counselor_user_id))
        candidates.push(entry.record)
      }
      const result = { imported:ids.length, ids }
      await database.prepare("UPDATE registry_imports SET status = 'committed', result_json = ?, preview_json = ? WHERE id = ?")
        .run(JSON.stringify(result), dataProtector.protectJson({ imported:ids.length }, 'registry-import:' + id), id)
      await audit(user.id, '确认导入学生登记表', 'registry_import', id, { imported:ids.length, counselorId:row.counselor_user_id })
      return result
    })
  }
  async function exportWorkbook(user, filters, template = false) {
    staff(user)
    const month = monthValue(filters.month), rows = template ? [] : await records(user, filters)
    const buffer = await writeRegistryWorkbook(rows, month)
    await audit(user.id, template ? '下载学生登记模板' : '导出学生登记表', 'registry_export', '', { count:rows.length, month })
    return buffer
  }
  async function printRecords(user, filters) {
    monthValue(filters.month)
    const rows = await records(user, filters)
    await audit(user.id, '打印学生登记表', 'registry_export', '', { count:rows.length, month:filters.month })
    return rows
  }
  return { listRegistryStudents:records, getRegistryStudent:getRecord, saveRegistryStudent:saveRecord, counselorProfile:profile,
    previewRegistryImport:preview, confirmRegistryImport:confirm, exportRegistryWorkbook:exportWorkbook, printRegistryStudents:printRecords }
}
module.exports = { createRegistryServices, normalizeRecord, monthValue }
