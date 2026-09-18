const { HttpError } = require("./errors")
const { inTransaction } = require("./database")
const { parseCsv, normalizeRows, validateFormat, passwordRecord, fileHash, safeRow } = require("./personnel-import")
const crypto = require("node:crypto")
const { isDeepStrictEqual } = require("node:util")

function createPersonnelImportServices(database, context) {
  const nowIso = context.nowIso
  const audit = context.audit
  const requireRole = context.requireRole

  async function previewPersonnelImport(user, input) {
    requireRole(user, "admin")
    input = input || {}
    const clientBatchId = String(input.clientBatchId || "").trim()
    const fileName = String(input.fileName || "").trim().slice(0, 128)
    const csvText = String(input.csvText || "")
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(clientBatchId)) {
      throw new HttpError(422, "IMPORT_BATCH_ID_INVALID", "导入批次编号不合法")
    }
    if (!/\.csv$/i.test(fileName)) throw new HttpError(422, "IMPORT_FILE_INVALID", "当前稳定导入格式为 CSV")
    if (Buffer.byteLength(csvText, "utf8") > 512 * 1024) throw new HttpError(413, "IMPORT_FILE_TOO_LARGE", "CSV 文件不能超过 512KB")
    const hash = fileHash(csvText)
    const existing = await database.prepare("SELECT * FROM import_batches WHERE client_batch_id = ?").get(clientBatchId)
    if (existing) {
      if (existing.file_hash !== hash) throw new HttpError(409, "IMPORT_BATCH_CONFLICT", "同一批次编号不能对应不同文件")
      return mapImportBatch(existing, true)
    }

    const headers = parseCsv(csvText)[0] || []
    const roster = input.format === "student-roster" || headers.some(value => ["班级", "手机号"].includes(value.trim()))
    const rows = roster ? await rosterRows(csvText) : normalizeRows(csvText)
    const result = await buildPlan(rows)
    const status = result.errors.length ? "校验失败" : "待确认"
    const insert = await database.prepare(`
      INSERT INTO import_batches
        (client_batch_id, file_name, file_hash, status, total_rows, create_count, update_count,
         unchanged_count, error_count, plan_json, errors_json, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientBatchId, fileName, hash, status, roster ? rows.filter(row => row.type === "student").length : rows.length, result.counts.create,
      result.counts.update, result.counts.unchanged, result.errors.length,
      JSON.stringify({ items:result.items }), JSON.stringify(result.errors), user.id, nowIso()
    )
    const batchId = Number(insert.lastInsertRowid)
    await audit(user.id, "预检人员导入", "import_batch", batchId, {
      fileName:fileName, status:status, totalRows:rows.length, errorCount:result.errors.length
    })
    return mapImportBatch(await database.prepare("SELECT * FROM import_batches WHERE id = ?").get(batchId), true)
  }

  async function rosterRows(csvText) {
    const parsed = parseCsv(csvText)
    if (JSON.stringify(parsed[0].map(value => value.trim())) !== JSON.stringify(["班级", "学号", "手机号"])) {
      throw new HttpError(422, "IMPORT_HEADER_INVALID", "表头必须按顺序为：班级,学号,手机号（不含姓名列）")
    }
    if (parsed.length < 2) throw new HttpError(422, "IMPORT_EMPTY", "CSV 中没有学生数据")
    if (parsed.length > 501) throw new HttpError(413, "IMPORT_TOO_MANY_ROWS", "单次最多导入500名学生")
    if (!context.dataProtector.enabled) throw new HttpError(503, "PHONE_ENCRYPTION_REQUIRED", "请先配置服务器数据加密密钥")
    const classes = new Map()
    const rows = []
    for (let index = 1; index < parsed.length; index++) {
      if (parsed[index].length !== 3) throw new HttpError(422, "IMPORT_ROW_INVALID", "第" + (index + 1) + "行必须恰好为三列")
      const [className, accountId, phone] = parsed[index].map(value => value.trim())
      if (!className || className.length > 50) throw new HttpError(422, "IMPORT_CLASS_INVALID", "第" + (index + 1) + "行班级不能为空且最多50字")
      if (!classes.has(className)) {
        const matches = await database.prepare("SELECT * FROM classes WHERE name = ?").all(className)
        if (matches.length > 1) throw new HttpError(409, "IMPORT_CLASS_AMBIGUOUS", "班级存在重名，请管理员先核实：" + className)
        if (matches.length && !matches[0].active) throw new HttpError(409, "IMPORT_CLASS_INACTIVE", "班级已停用：" + className)
        const classId = matches.length ? matches[0].id : "R" + crypto.createHash("sha256").update(className).digest("hex").slice(0, 24).toUpperCase()
        classes.set(className, classId)
        if (!matches.length) rows.push({ type:"class", rowNumber:index + 1, classId, className, major:"" })
      }
      rows.push({ type:"student", roster:true, rowNumber:index + 1, accountId:accountId.toLowerCase(), classId:classes.get(className), className, name:"", phone, password:phone.slice(-6) })
    }
    return rows
  }

  async function buildPlan(rows) {
    const errors = []
    const duplicateKeys = Object.create(null)
    rows.forEach(function(row) {
      errors.push.apply(errors, validateFormat(row))
      const key = rowKey(row)
      if (!key) return
      if (duplicateKeys[key]) errors.push({ rowNumber:row.rowNumber, field:"唯一标识", message:"与第 " + duplicateKeys[key] + " 行重复" })
      else duplicateKeys[key] = row.rowNumber
    })

    const plannedClassIds = new Set(rows.filter(function(row) { return row.type === "class" }).map(function(row) { return row.classId }))
    const plannedCounselors = new Set(rows.filter(function(row) { return row.type === "counselor" }).map(function(row) { return row.accountId }))
    for (const row of rows) {
      if (row.type === "student" && !await classExists(row.classId, plannedClassIds)) {
        errors.push({ rowNumber:row.rowNumber, field:"班级编号", message:"班级不存在，需先在同一文件添加班级行" })
      }
      if (row.type === "assignment") {
        if (!await classExists(row.classId, plannedClassIds)) errors.push({ rowNumber:row.rowNumber, field:"班级编号", message:"分配的班级不存在" })
        if (!await counselorExists(row.accountId, plannedCounselors)) errors.push({ rowNumber:row.rowNumber, field:"账号", message:"分配的辅导员不存在" })
        if (!await database.prepare("SELECT 1 FROM semesters WHERE id = ?").get(row.semesterId)) {
          errors.push({ rowNumber:row.rowNumber, field:"学期编号", message:"学期不存在" })
        }
      }
    }

    const invalidRows = new Set(errors.map(function(error) { return error.rowNumber }))
    const orderedRows = rows.slice().sort(function(left, right) { return entityOrder(left.type) - entityOrder(right.type) || left.rowNumber - right.rowNumber })
    const validRows = orderedRows.filter(function(row) { return !invalidRows.has(row.rowNumber) })
    const items = await mapWithConcurrency(validRows, 8, async function(row) {
      if (invalidRows.has(row.rowNumber)) return
      try {
        if (row.type === "class") return await classPlan(row)
        if (row.type === "student" || row.type === "counselor") return await userPlan(row)
        if (row.type === "assignment") return await assignmentPlan(row)
      } catch (error) {
        if (error instanceof HttpError) errors.push({ rowNumber:row.rowNumber, field:"数据冲突", message:error.message })
        else throw error
      }
      return null
    })
    const plannedItems = items.filter(Boolean)
    const counts = { create:0, update:0, unchanged:0 }
    plannedItems.forEach(function(item) { counts[item.operation]++ })
    return { items:plannedItems, errors:errors, counts:counts }
  }

  async function classExists(classId, planned) {
    if (planned.has(classId)) return true
    const existing = await database.prepare("SELECT active FROM classes WHERE id = ?").get(classId)
    return !!(existing && existing.active)
  }

  async function counselorExists(accountId, planned) {
    if (planned.has(accountId)) return true
    const existing = await database.prepare("SELECT active FROM users WHERE role = 'counselor' AND account_id = ?").get(accountId)
    return !!(existing && existing.active)
  }

  async function classPlan(row) {
    const existing = await database.prepare("SELECT * FROM classes WHERE id = ?").get(row.classId)
    const before = existing ? classSnapshot(existing) : null
    const after = {
      id:row.classId, name:row.className, major:row.major || (before ? before.major : ""), active:1
    }
    return planItem(row, "class", row.classId, before ? (same(before, after) ? "unchanged" : "update") : "create", before, after,
      "班级 " + row.className)
  }

  async function userPlan(row) {
    const role = row.type
    const identityColumn = role === "student" ? "student_no" : "staff_no"
    const matches = await database.prepare(`SELECT * FROM users WHERE account_id = ? OR ${identityColumn} = ?`).all(row.accountId, row.accountId)
    const unique = Array.from(new Map(matches.map(function(item) { return [item.id, item] })).values())
    if (unique.length > 1) throw new HttpError(409, "IMPORT_IDENTITY_CONFLICT", "账号与学工号分别属于不同用户")
    const existing = unique[0] || null
    if (existing && existing.role !== role) throw new HttpError(409, "IMPORT_ROLE_CONFLICT", "该账号已被其他角色使用")
    if (!existing && !row.password) throw new HttpError(422, "IMPORT_PASSWORD_REQUIRED", "新增账号必须填写至少 8 位初始密码")
    // Re-imports update roster data, never reset a student's password or name.
    const password = row.roster && existing ? null : await passwordRecord(row)
    const before = existing ? userSnapshot(existing) : null
    const id = before ? before.id : role + "-" + row.accountId
    const idOwner = await database.prepare("SELECT account_id FROM users WHERE id = ?").get(id)
    if (!before && idOwner) throw new HttpError(409, "IMPORT_USER_ID_CONFLICT", "系统用户编号已被占用")
    const after = {
      id:id,
      role:role,
      accountId:row.accountId,
      passwordHash:password ? password.hash : before.passwordHash,
      passwordSalt:password ? password.salt : before.passwordSalt,
      displayName:row.roster ? (before ? before.displayName : "") : row.name,
      studentNo:role === "student" ? row.accountId : null,
      staffNo:role === "counselor" ? row.accountId.toUpperCase() : null,
      classId:role === "student" ? row.classId : null,
      active:1,
      createdAt:before ? before.createdAt : nowIso(),
      phoneEncrypted:before ? before.phoneEncrypted : null,
      profileCompleted:before ? before.profileCompleted : (row.roster ? 0 : 1),
      mustChangePassword:before ? before.mustChangePassword : (row.roster ? 1 : 0),
      profileConsentAt:before ? before.profileConsentAt : null
    }
    if (row.roster) {
      const oldPhone = before && before.phoneEncrypted ? context.dataProtector.unprotectText(before.phoneEncrypted, "student-phone:" + id) : ""
      if (oldPhone !== row.phone) after.phoneEncrypted = context.dataProtector.protectText(row.phone, "student-phone:" + id)
    }
    const operation = before ? (same(before, after) ? "unchanged" : "update") : "create"
    return planItem(row, "user", row.accountId, operation, before, after,
      (role === "student" ? "学生 " : "辅导员 ") + (row.roster ? row.accountId + " · " + row.className : row.name))
  }

  async function assignmentPlan(row) {
    const counselor = await database.prepare("SELECT * FROM users WHERE role = 'counselor' AND account_id = ?").get(row.accountId)
    const counselorId = counselor ? counselor.id : "counselor-" + row.accountId
    const existing = await database.prepare(`
      SELECT * FROM counselor_class_assignments
      WHERE counselor_user_id = ? AND class_id = ? AND semester_id = ?
    `).get(counselorId, row.classId, row.semesterId)
    const before = existing ? assignmentSnapshot(existing) : null
    const after = {
      counselorUserId:counselorId, classId:row.classId, semesterId:row.semesterId,
      active:1, createdAt:before ? before.createdAt : nowIso()
    }
    const operation = before ? (same(before, after) ? "unchanged" : "update") : "create"
    const key = counselorId + ":" + row.classId + ":" + row.semesterId
    return planItem(row, "assignment", key, operation, before, after, "分配辅导员 " + row.accountId + " 至班级 " + row.classId)
  }

  function planItem(row, entityType, entityKey, operation, before, after, summary) {
    return { row:safeRow(row), entityType:entityType, entityKey:entityKey, operation:operation, before:before, after:after, summary:summary }
  }

  async function listImportBatches(user) {
    requireRole(user, "admin")
    return (await database.prepare("SELECT * FROM import_batches ORDER BY created_at DESC, id DESC LIMIT 100").all()).map(function(row) {
      return mapImportBatch(row, false)
    })
  }

  async function getImportBatch(user, batchId) {
    requireRole(user, "admin")
    const row = await findBatch(batchId)
    return mapImportBatch(row, true)
  }

  async function confirmImportBatch(user, batchId) {
    requireRole(user, "admin")
    const batch = await findBatch(batchId)
    if (batch.status === "已导入") return mapImportBatch(batch, true)
    if (batch.status !== "待确认") throw new HttpError(409, "IMPORT_NOT_CONFIRMABLE", "当前批次不能确认导入")
    const plan = parseJson(batch.plan_json, { items:[] })
    await inTransaction(database, async function() {
      let sequence = 0
      for (const item of plan.items) {
        if (item.operation === "unchanged") continue
        await assertPlanFresh(item)
        await applyItem(item)
        sequence++
        await database.prepare(`
          INSERT INTO import_batch_changes
            (batch_id, sequence_no, entity_type, entity_key, operation, before_json, after_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(batch.id, sequence, item.entityType, item.entityKey, item.operation,
          item.before ? JSON.stringify(item.before) : null, JSON.stringify(item.after))
      }
      await database.prepare("UPDATE import_batches SET status = '已导入', applied_at = ? WHERE id = ?").run(nowIso(), batch.id)
      await audit(user.id, "确认人员导入", "import_batch", batch.id, {
        createCount:batch.create_count, updateCount:batch.update_count, unchangedCount:batch.unchanged_count
      })
    })
    return mapImportBatch(await findBatch(batch.id), true)
  }

  async function rollbackImportBatch(user, batchId) {
    requireRole(user, "admin")
    const batch = await findBatch(batchId)
    if (batch.status === "已回滚") return mapImportBatch(batch, true)
    if (batch.status !== "已导入") throw new HttpError(409, "IMPORT_NOT_ROLLBACKABLE", "只有已导入批次可以回滚")
    const changes = await database.prepare("SELECT * FROM import_batch_changes WHERE batch_id = ? ORDER BY sequence_no DESC").all(batch.id)
    await inTransaction(database, async function() {
      for (const change of changes) {
        const after = parseJson(change.after_json, null)
        const before = parseJson(change.before_json, null)
        await assertChangeFresh(change, after)
        await rollbackChange(change, before, after)
      }
      await database.prepare("UPDATE import_batches SET status = '已回滚', rolled_back_at = ? WHERE id = ?").run(nowIso(), batch.id)
      await audit(user.id, "回滚人员导入", "import_batch", batch.id, { changeCount:changes.length })
    })
    return mapImportBatch(await findBatch(batch.id), true)
  }

  async function assertPlanFresh(item) {
    const current = await currentSnapshot(item.entityType, item.after)
    if (item.operation === "create" && current) throw new HttpError(409, "IMPORT_PREVIEW_STALE", "预检后数据已变化，请重新选择文件预检")
    if (item.operation === "update" && !same(current, item.before)) throw new HttpError(409, "IMPORT_PREVIEW_STALE", "预检后数据已变化，请重新选择文件预检")
  }

  async function assertChangeFresh(change, after) {
    const current = await currentSnapshot(change.entity_type, after)
    if (!same(current, after)) throw new HttpError(409, "IMPORT_ROLLBACK_STALE", "导入后相关数据已再次修改，不能自动覆盖回滚", {
      entityType:change.entity_type,
      entityKey:change.entity_key
    })
  }

  async function currentSnapshot(entityType, data) {
    if (entityType === "class") {
      const row = await database.prepare("SELECT * FROM classes WHERE id = ?").get(data.id)
      return row ? classSnapshot(row) : null
    }
    if (entityType === "user") {
      const row = await database.prepare("SELECT * FROM users WHERE id = ?").get(data.id)
      return row ? userSnapshot(row) : null
    }
    const row = await database.prepare(`
      SELECT * FROM counselor_class_assignments WHERE counselor_user_id = ? AND class_id = ? AND semester_id = ?
    `).get(data.counselorUserId, data.classId, data.semesterId)
    return row ? assignmentSnapshot(row) : null
  }

  async function applyItem(item) {
    const value = item.after
    if (item.entityType === "class") {
      if (item.operation === "create") await database.prepare("INSERT INTO classes (id, name, major, active) VALUES (?, ?, ?, ?)").run(value.id, value.name, value.major, value.active)
      else await database.prepare("UPDATE classes SET name = ?, major = ?, active = ? WHERE id = ?").run(value.name, value.major, value.active, value.id)
      return
    }
    if (item.entityType === "user") {
      if (item.operation === "create") {
        await database.prepare(`
          INSERT INTO users
            (id, role, account_id, password_hash, password_salt, display_name, student_no, staff_no, class_id, active, created_at,
             phone_encrypted, profile_completed, must_change_password, profile_consent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(value.id, value.role, value.accountId, value.passwordHash, value.passwordSalt, value.displayName,
          value.studentNo, value.staffNo, value.classId, value.active, value.createdAt,
          value.phoneEncrypted || null, value.profileCompleted ?? 1, value.mustChangePassword ?? 0, value.profileConsentAt || null)
      } else {
        await database.prepare(`
          UPDATE users SET password_hash = ?, password_salt = ?, display_name = ?, student_no = ?,
            staff_no = ?, class_id = ?, active = ?, phone_encrypted = ?, profile_completed = ?,
            must_change_password = ?, profile_consent_at = ? WHERE id = ?
        `).run(value.passwordHash, value.passwordSalt, value.displayName, value.studentNo,
          value.staffNo, value.classId, value.active, value.phoneEncrypted || null,
          value.profileCompleted ?? 1, value.mustChangePassword ?? 0, value.profileConsentAt || null, value.id)
      }
      return
    }
    if (item.operation === "create") {
      await database.prepare(`
        INSERT INTO counselor_class_assignments (counselor_user_id, class_id, semester_id, active, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(value.counselorUserId, value.classId, value.semesterId, value.active, value.createdAt)
    } else {
      await database.prepare(`
        UPDATE counselor_class_assignments SET active = ?
        WHERE counselor_user_id = ? AND class_id = ? AND semester_id = ?
      `).run(value.active, value.counselorUserId, value.classId, value.semesterId)
    }
  }

  async function rollbackChange(change, before, after) {
    if (change.operation === "create") {
      if (change.entity_type === "class") await database.prepare("UPDATE classes SET active = 0 WHERE id = ?").run(after.id)
      else if (change.entity_type === "user") await database.prepare("UPDATE users SET active = 0 WHERE id = ?").run(after.id)
      else await database.prepare(`
        UPDATE counselor_class_assignments SET active = 0
        WHERE counselor_user_id = ? AND class_id = ? AND semester_id = ?
      `).run(after.counselorUserId, after.classId, after.semesterId)
      return
    }
    await applyItem({ entityType:change.entity_type, operation:"update", after:before })
  }

  async function listAdminStudents(user) {
    requireRole(user, "admin")
    return (await database.prepare(`
      SELECT u.student_no, u.display_name, u.class_id, u.active, u.phone_encrypted, u.profile_completed, u.must_change_password, c.name AS class_name, c.major
      FROM users u LEFT JOIN classes c ON c.id = u.class_id
      WHERE u.role = 'student' ORDER BY u.student_no
    `).all()).map(function(row) {
      return { studentId:row.student_no, studentName:row.display_name, classId:row.class_id || "", className:row.class_name || "", major:row.major || "", active:!!row.active,
        canResetPassword:!!row.phone_encrypted && !!row.active, profileCompleted:!!row.profile_completed, mustChangePassword:!!row.must_change_password }
    })
  }

  async function listAdminAssignments(user, semesterId) {
    requireRole(user, "admin")
    const params = []
    let clause = ""
    if (semesterId) { clause = "WHERE a.semester_id = ?"; params.push(semesterId) }
    return (await database.prepare(`
      SELECT a.*, u.staff_no, u.display_name, c.name AS class_name, s.name AS semester_name
      FROM counselor_class_assignments a
      JOIN users u ON u.id = a.counselor_user_id
      JOIN classes c ON c.id = a.class_id
      JOIN semesters s ON s.id = a.semester_id
      ${clause}
      ORDER BY s.start_date DESC, u.staff_no, c.id
    `).all(...params)).map(function(row) {
      return { key:row.counselor_user_id + ":" + row.class_id + ":" + row.semester_id, staffId:row.staff_no, counselorName:row.display_name, classId:row.class_id, className:row.class_name, semesterId:row.semester_id, semesterName:row.semester_name, active:!!row.active }
    })
  }

  async function findBatch(batchId) {
    const row = await database.prepare("SELECT * FROM import_batches WHERE id = ?").get(Number(batchId))
    if (!row) throw new HttpError(404, "IMPORT_BATCH_NOT_FOUND", "导入批次不存在")
    return row
  }

  return {
    previewPersonnelImport,
    listImportBatches,
    getImportBatch,
    confirmImportBatch,
    rollbackImportBatch,
    listAdminStudents,
    listAdminAssignments
  }
}

function rowKey(row) {
  if (row.type === "class") return "class:" + row.classId
  if (row.type === "student" || row.type === "counselor") return "account:" + row.accountId
  if (row.type === "assignment") return "assignment:" + row.accountId + ":" + row.classId + ":" + row.semesterId
  return ""
}

function entityOrder(type) {
  return type === "class" ? 1 : (type === "student" || type === "counselor" ? 2 : 3)
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length:Math.min(limit, items.length || 1) }, worker))
  return results
}

function classSnapshot(row) {
  return { id:row.id, name:row.name, major:row.major, active:Number(row.active) }
}

function userSnapshot(row) {
  return {
    id:row.id, role:row.role, accountId:row.account_id, passwordHash:row.password_hash,
    passwordSalt:row.password_salt, displayName:row.display_name, studentNo:row.student_no,
    staffNo:row.staff_no, classId:row.class_id, active:Number(row.active), createdAt:row.created_at,
    phoneEncrypted:row.phone_encrypted || null, profileCompleted:Number(row.profile_completed),
    mustChangePassword:Number(row.must_change_password), profileConsentAt:row.profile_consent_at || null
  }
}

function assignmentSnapshot(row) {
  return {
    counselorUserId:row.counselor_user_id, classId:row.class_id, semesterId:row.semester_id,
    active:Number(row.active), createdAt:row.created_at
  }
}

function same(left, right) {
  return isDeepStrictEqual(left, right)
}

function parseJson(value, fallback) {
  if (value !== null && typeof value === "object") return value
  try { return JSON.parse(value) } catch (error) { return fallback }
}

function mapImportBatch(row, includeDetails) {
  const result = {
    id:row.id,
    clientBatchId:row.client_batch_id,
    fileName:row.file_name,
    status:row.status,
    totalRows:row.total_rows,
    createCount:row.create_count,
    updateCount:row.update_count,
    unchangedCount:row.unchanged_count,
    errorCount:row.error_count,
    createdAt:row.created_at,
    appliedAt:row.applied_at || "",
    rolledBackAt:row.rolled_back_at || "",
    canConfirm:row.status === "待确认",
    canRollback:row.status === "已导入"
  }
  if (includeDetails) {
    const plan = parseJson(row.plan_json, { items:[] })
    result.items = plan.items.map(function(item) {
      return { rowNumber:item.row.rowNumber, type:item.row.type, entityKey:item.entityKey, operation:item.operation, summary:item.summary }
    })
    result.errors = parseJson(row.errors_json, [])
  }
  return result
}

module.exports = { createPersonnelImportServices }
