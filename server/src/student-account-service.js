const { HttpError } = require("./errors")
const { inTransaction } = require("./database")
const { createPasswordRecordAsync, verifyPasswordAsync } = require("./security")

function createStudentAccountServices(database, context) {
  const { requireRole, publicUser, audit, nowIso } = context

  async function updateStudentProfile(user, input) {
    requireRole(user, "student")
    const allowed = ["displayName", "consent"]
    if (Object.keys(input || {}).some(key => !allowed.includes(key))) throw new HttpError(422, "PROFILE_FIELDS_INVALID", "仅可修改姓名，学号和班级由管理员维护")
    const displayName = String(input && input.displayName || "").trim()
    if (!displayName || displayName.length > 50 || /[\u0000-\u001f\u007f]/.test(displayName)) throw new HttpError(422, "PROFILE_NAME_INVALID", "请填写1至50字的姓名")
    if (!input || input.consent !== true) throw new HttpError(422, "PROFILE_CONSENT_REQUIRED", "请阅读并同意姓名填写说明")
    await inTransaction(database, async () => {
      await database.prepare("UPDATE users SET display_name = ?, profile_completed = 1, profile_consent_at = ? WHERE id = ?")
        .run(displayName, nowIso(), user.id)
      await audit(user.id, "学生补充姓名", "user", user.id, { consentVersion:"student-profile-v1" })
    })
    return publicUser(await database.prepare("SELECT * FROM users WHERE id = ?").get(user.id))
  }

  async function changePassword(user, input) {
    const currentPassword = String(input && input.currentPassword || "")
    const newPassword = String(input && input.newPassword || "")
    if (newPassword.length < 8 || newPassword.length > 64) throw new HttpError(422, "PASSWORD_INVALID", "新密码长度需为8至64位")
    if (newPassword === currentPassword) throw new HttpError(422, "PASSWORD_UNCHANGED", "新密码不能与原密码相同")
    if (!await verifyPasswordAsync(currentPassword, user.password_salt, user.password_hash)) throw new HttpError(422, "PASSWORD_INCORRECT", "原密码不正确")
    const record = await createPasswordRecordAsync(newPassword)
    await inTransaction(database, async () => {
      const result = await database.prepare(`UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0,
        auth_version = auth_version + 1 WHERE id = ? AND password_hash = ? AND auth_version = ?`)
        .run(record.hash, record.salt, user.id, user.password_hash, Number(user.auth_version || 0))
      if (!result.changes) throw new HttpError(409, "ACCOUNT_CHANGED", "账号状态已变化，请重新登录")
      await database.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(nowIso(), user.id)
      await audit(user.id, "修改密码", "user", user.id, {})
    })
    return { changed:true, loginRequired:true }
  }

  async function resetStudentPassword(actor, studentId) {
    requireRole(actor, "admin")
    const student = await database.prepare("SELECT * FROM users WHERE role = 'student' AND student_no = ? AND active = 1").get(studentId)
    if (!student) throw new HttpError(404, "STUDENT_NOT_FOUND", "学生账号不存在或已停用")
    const studentNo = String(student.student_no || "")
    if (studentNo.length < 4) throw new HttpError(409, "STUDENT_ID_INVALID", "该学生学号不足4位，请管理员先修正账号")
    const record = await createPasswordRecordAsync(studentNo.slice(-4))
    await inTransaction(database, async () => {
      const result = await database.prepare(`UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1,
        auth_version = auth_version + 1 WHERE id = ? AND active = 1 AND student_no = ? AND auth_version = ?`)
        .run(record.hash, record.salt, student.id, studentNo, Number(student.auth_version || 0))
      if (!result.changes) throw new HttpError(409, "ACCOUNT_CHANGED", "学生资料已变化，请刷新后重试")
      await database.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(nowIso(), student.id)
      await database.prepare("DELETE FROM auth_login_attempts WHERE attempt_key = ?").run("student:" + student.account_id)
      await audit(actor.id, "重置学生密码", "user", student.id, { method:"student-id-last-four" })
    })
    return { reset:true, mustChangePassword:true }
  }

  return { updateStudentProfile, changePassword, resetStudentPassword }
}

module.exports = { createStudentAccountServices }
