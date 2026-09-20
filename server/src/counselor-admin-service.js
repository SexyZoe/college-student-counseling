const crypto = require("node:crypto")
const { HttpError } = require("./errors")
const { inTransaction } = require("./database")
const { normalizeAccountId, createPasswordRecordAsync } = require("./security")

const COUNSELOR_TEMPORARY_PASSWORD = "123456"

function createCounselorAdminServices(database, context) {
  const { requireRole, audit, nowIso } = context

  async function listAdminCounselors(user) {
    requireRole(user, "admin")
    const rows = await database.prepare(`
      SELECT u.id, u.account_id, u.staff_no, u.display_name, u.active, u.must_change_password,
             COUNT(a.class_id) AS active_class_count
      FROM users u
      LEFT JOIN counselor_class_assignments a ON a.counselor_user_id = u.id
        AND a.active = 1
        AND a.semester_id = (SELECT id FROM semesters WHERE status = '当前学期' LIMIT 1)
      WHERE u.role = 'counselor'
      GROUP BY u.id, u.account_id, u.staff_no, u.display_name, u.active, u.must_change_password
      ORDER BY u.staff_no, u.account_id
    `).all()
    return rows.map(mapCounselor)
  }

  async function createAdminCounselor(user, input) {
    requireRole(user, "admin")
    input = input || {}
    const staffId = String(input.staffId || "").trim().toUpperCase()
    const accountId = normalizeAccountId(staffId)
    const displayName = String(input.displayName || "").trim()
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(staffId)) {
      throw new HttpError(422, "COUNSELOR_STAFF_ID_INVALID", "工号需为2至32位字母、数字、下划线或短横线")
    }
    if (!displayName || displayName.length > 50 || /[\u0000-\u001f\u007f]/.test(displayName)) {
      throw new HttpError(422, "COUNSELOR_NAME_INVALID", "请填写1至50字的辅导员姓名")
    }
    const existing = await database.prepare("SELECT id FROM users WHERE account_id = ? OR staff_no = ?").all(accountId, staffId)
    if (existing.length) throw new HttpError(409, "COUNSELOR_EXISTS", "该工号已被使用")
    const record = await createPasswordRecordAsync(COUNSELOR_TEMPORARY_PASSWORD)
    const id = "counselor-" + crypto.randomUUID()
    await inTransaction(database, async function() {
      await database.prepare(`
        INSERT INTO users
          (id, role, account_id, password_hash, password_salt, display_name, staff_no, active,
           profile_completed, must_change_password, auth_version, created_at)
        VALUES (?, 'counselor', ?, ?, ?, ?, ?, 1, 1, 1, 0, ?)
      `).run(id, accountId, record.hash, record.salt, displayName, staffId, nowIso())
      await audit(user.id, "创建辅导员账号", "user", id, { staffId:staffId, temporaryPassword:true })
    })
    return mapCounselor(await database.prepare(`
      SELECT u.id, u.account_id, u.staff_no, u.display_name, u.active, u.must_change_password,
             0 AS active_class_count FROM users u WHERE u.id = ?
    `).get(id))
  }

  async function resetCounselorPassword(user, staffIdValue) {
    requireRole(user, "admin")
    const staffId = String(staffIdValue || "").trim().toUpperCase()
    const counselor = await database.prepare("SELECT * FROM users WHERE role = 'counselor' AND staff_no = ?").get(staffId)
    if (!counselor) throw new HttpError(404, "COUNSELOR_NOT_FOUND", "辅导员账号不存在")
    const record = await createPasswordRecordAsync(COUNSELOR_TEMPORARY_PASSWORD)
    await inTransaction(database, async function() {
      const result = await database.prepare(`UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1,
        auth_version = auth_version + 1 WHERE id = ? AND auth_version = ?`)
        .run(record.hash, record.salt, counselor.id, Number(counselor.auth_version || 0))
      if (!result.changes) throw new HttpError(409, "ACCOUNT_CHANGED", "辅导员账号状态已变化，请刷新后重试")
      await database.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(nowIso(), counselor.id)
      await database.prepare("DELETE FROM auth_login_attempts WHERE attempt_key = ?").run("counselor:" + counselor.account_id)
      await audit(user.id, "重置辅导员密码", "user", counselor.id, { method:"administrator-temporary-password" })
    })
    return { reset:true, temporaryPassword:COUNSELOR_TEMPORARY_PASSWORD, mustChangePassword:true }
  }

  async function setCounselorStatus(user, staffIdValue, input) {
    requireRole(user, "admin")
    const staffId = String(staffIdValue || "").trim().toUpperCase()
    if (!input || typeof input.active !== "boolean") throw new HttpError(422, "COUNSELOR_STATUS_INVALID", "请提供账号启用状态")
    const counselor = await database.prepare("SELECT * FROM users WHERE role = 'counselor' AND staff_no = ?").get(staffId)
    if (!counselor) throw new HttpError(404, "COUNSELOR_NOT_FOUND", "辅导员账号不存在")
    const active = input.active ? 1 : 0
    await inTransaction(database, async function() {
      await database.prepare("UPDATE users SET active = ?, auth_version = auth_version + 1 WHERE id = ?").run(active, counselor.id)
      if (!active) {
        const endedAt = nowIso()
        await database.prepare(`
          UPDATE counselor_class_assignments
          SET active = 0, ended_at = ?, updated_at = ?
          WHERE counselor_user_id = ? AND active = 1
        `).run(endedAt, endedAt, counselor.id)
      }
      await database.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(nowIso(), counselor.id)
      await audit(user.id, active ? "启用辅导员账号" : "停用辅导员账号", "user", counselor.id, { staffId:staffId })
    })
    return { staffId:staffId, active:!!active }
  }

  async function listAdminClasses(user, semesterIdValue) {
    requireRole(user, "admin")
    let semesterId = String(semesterIdValue || "").trim()
    if (!semesterId) {
      const current = await database.prepare("SELECT id FROM semesters WHERE status = '当前学期' LIMIT 1").get()
      semesterId = current ? current.id : ""
    }
    const classes = await database.prepare(`
      SELECT c.id, c.name, c.major, c.active, COUNT(u.id) AS student_count
      FROM classes c
      LEFT JOIN users u ON u.class_id = c.id AND u.role = 'student' AND u.active = 1
      GROUP BY c.id, c.name, c.major, c.active
      ORDER BY c.name, c.id
    `).all()
    const assignments = semesterId ? await database.prepare(`
      SELECT a.class_id, a.semester_id, u.staff_no, u.display_name
      FROM counselor_class_assignments a
      JOIN users u ON u.id = a.counselor_user_id AND u.active = 1
      WHERE a.semester_id = ? AND a.active = 1
      ORDER BY a.created_at DESC
    `).all(semesterId) : []
    const byClass = new Map()
    assignments.forEach(function(row) { if (!byClass.has(row.class_id)) byClass.set(row.class_id, row) })
    return classes.map(function(row) {
      const assignment = byClass.get(row.id)
      return {
        id:row.id, name:row.name, major:row.major || "", active:!!row.active,
        studentCount:Number(row.student_count || 0), semesterId:semesterId,
        counselor:assignment ? { staffId:assignment.staff_no, displayName:assignment.display_name } : null
      }
    })
  }

  function mapCounselor(row) {
    return {
      id:row.id,
      accountId:row.account_id,
      staffId:row.staff_no || "",
      displayName:row.display_name,
      active:!!row.active,
      mustChangePassword:!!row.must_change_password,
      activeClassCount:Number(row.active_class_count || 0)
    }
  }

  return {
    listAdminCounselors,
    createAdminCounselor,
    resetCounselorPassword,
    setCounselorStatus,
    listAdminClasses
  }
}

module.exports = { createCounselorAdminServices, COUNSELOR_TEMPORARY_PASSWORD }
