const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { openDatabase, seedDemoData } = require("../src/database")
const { createServices } = require("../src/services")
const { createHttpApp } = require("../src/app")

const config = {
  authSecret:"counselor-administration-test-secret",
  dataEncryptionKey:"cd".repeat(32),
  tokenTtlSeconds:3600,
  maxBodyBytes:1024 * 1024,
  logLevel:"error",
  generalRateLimitPerMinute:5000,
  loginRateLimitPerMinute:1000
}

let database, server, baseUrl, adminToken, studentToken

async function api(path, token, method = "GET", body) {
  const response = await fetch(baseUrl + "/api/v1" + path, {
    method,
    headers:{ "content-type":"application/json", ...(token ? { authorization:"Bearer " + token } : {}) },
    body:body === undefined ? undefined : JSON.stringify(body)
  })
  return { status:response.status, body:await response.json() }
}

async function login(role, accountId, password) {
  return api("/auth/login", null, "POST", { role, accountId, password })
}

test.before(async function() {
  database = openDatabase(":memory:")
  await seedDemoData(database)
  server = http.createServer(createHttpApp(createServices(database, config), config))
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  baseUrl = "http://127.0.0.1:" + server.address().port
  adminToken = (await login("admin", "admin", "123456")).body.data.token
  studentToken = (await login("student", "2024001", "123456")).body.data.token
})

test.after(async function() {
  if (server) await new Promise(resolve => server.close(resolve))
  if (database) database.close()
})

test("管理员统一建立辅导员账号并分配班级", async function(t) {
  let counselorToken

  await t.test("非管理员不能创建辅导员", async function() {
    const response = await api("/admin/counselors", studentToken, "POST", { staffId:"T009", displayName:"赵辅导员" })
    assert.equal(response.status, 403)
  })

  await t.test("新账号使用123456并标记强制改密", async function() {
    const created = await api("/admin/counselors", adminToken, "POST", { staffId:"T009", displayName:"赵辅导员" })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.staffId, "T009")
    assert.equal(created.body.data.mustChangePassword, true)
    assert.equal((await api("/admin/counselors", adminToken, "POST", { staffId:"T009", displayName:"重复" })).status, 409)
    const loggedIn = await login("counselor", "T009", "123456")
    assert.equal(loggedIn.status, 200)
    counselorToken = loggedIn.body.data.token
    assert.equal(loggedIn.body.data.user.mustChangePassword, true)
  })

  await t.test("改密前服务端拒绝辅导员业务访问", async function() {
    const blocked = await api("/counselor/classes", counselorToken)
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error.code, "PASSWORD_CHANGE_REQUIRED")
    assert.equal((await api("/account", counselorToken)).status, 200)
  })

  await t.test("修改临时密码后旧会话和旧密码失效", async function() {
    const changed = await api("/account/password", counselorToken, "POST", { currentPassword:"123456", newPassword:"CounselorNew123" })
    assert.equal(changed.status, 200)
    assert.equal((await api("/account", counselorToken)).status, 401)
    assert.equal((await login("counselor", "T009", "123456")).status, 401)
    const loggedIn = await login("counselor", "T009", "CounselorNew123")
    assert.equal(loggedIn.status, 200)
    counselorToken = loggedIn.body.data.token
    assert.equal(loggedIn.body.data.user.mustChangePassword, false)
  })

  await t.test("管理员按学期分配，同班新分配替代原负责人", async function() {
    const assigned = await api("/admin/counselor-assignments", adminToken, "POST", { staffId:"T009", classId:"CS2401", semesterId:"2026-1" })
    assert.equal(assigned.status, 201)
    const classes = await api("/counselor/classes", counselorToken)
    assert.equal(classes.status, 200)
    assert.deepEqual(classes.body.data.map(item => item.id), ["CS2401"])
    const oldAssignment = database.prepare(`SELECT active, ended_at FROM counselor_class_assignments
      WHERE counselor_user_id = 'counselor-t001' AND class_id = 'CS2401' AND semester_id = '2026-1'`).get()
    assert.equal(oldAssignment.active, 0)
    assert.ok(oldAssignment.ended_at)
    const adminClasses = await api("/admin/classes?semesterId=2026-1", adminToken)
    assert.equal(adminClasses.body.data.find(item => item.id === "CS2401").counselor.staffId, "T009")
  })

  await t.test("撤销分配后辅导员不再看到该班", async function() {
    const revoked = await api("/admin/counselor-assignments", adminToken, "PATCH", { staffId:"T009", classId:"CS2401", semesterId:"2026-1" })
    assert.equal(revoked.status, 200)
    assert.deepEqual((await api("/counselor/classes", counselorToken)).body.data, [])
  })

  await t.test("管理员重置辅导员密码后再次强制改密", async function() {
    const reset = await api("/admin/counselors/T009/reset-password", adminToken, "POST", {})
    assert.equal(reset.status, 200)
    assert.equal(reset.body.data.temporaryPassword, "123456")
    assert.equal((await api("/account", counselorToken)).status, 401)
    const loggedIn = await login("counselor", "T009", "123456")
    assert.equal(loggedIn.status, 200)
    assert.equal(loggedIn.body.data.user.mustChangePassword, true)
  })

  await t.test("停用账号后无法登录", async function() {
    assert.equal((await api("/admin/counselor-assignments", adminToken, "POST", { staffId:"T009", classId:"AI2401", semesterId:"2026-1" })).status, 201)
    const disabled = await api("/admin/counselors/T009/status", adminToken, "PATCH", { active:false })
    assert.equal(disabled.status, 200)
    assert.equal((await login("counselor", "T009", "123456")).status, 401)
    const counselorId = database.prepare("SELECT id FROM users WHERE staff_no = ?").get("T009").id
    assert.equal(database.prepare(`SELECT active FROM counselor_class_assignments
      WHERE counselor_user_id = ? AND class_id = ? AND semester_id = ?`).get(counselorId, "AI2401", "2026-1").active, 0)
    const auditActions = database.prepare("SELECT action FROM audit_logs WHERE actor_user_id = 'admin-a001'").all().map(row => row.action)
    assert.ok(auditActions.includes("创建辅导员账号"))
    assert.ok(auditActions.includes("分配辅导员班级"))
    assert.ok(auditActions.includes("撤销辅导员班级"))
  })
})
