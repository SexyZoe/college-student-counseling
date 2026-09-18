const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const crypto = require("node:crypto")
const { execFileSync } = require("node:child_process")
const path = require("node:path")
const { openDatabase, openConfiguredDatabase, seedDemoData } = require("../src/database")
const { loadConfig } = require("../src/config")
const { createServices } = require("../src/services")
const { createHttpApp } = require("../src/app")
const { createDataProtector } = require("../src/data-protection")
const config = Object.assign({}, loadConfig({}), {
  authSecret:"isolated-student-account-test-secret", dataEncryptionKey:"ab".repeat(32),
  tokenTtlSeconds:3600, logLevel:"error", generalRateLimitPerMinute:5000, loginRateLimitPerMinute:1000
})
let database, server, baseUrl, admin, counselor, initialToken, studentToken, batchId
const phone = "13812003456"
const accountId = "002026001"
const roster = "班级,学号,手机号\n软件工程1班," + accountId + "," + phone
const key = () => "roster:" + crypto.randomUUID()
async function api(route, token, method = "GET", data) {
  const response = await fetch(baseUrl + "/api/v1" + route, {
    method, headers:{ "content-type":"application/json", ...(token ? { authorization:"Bearer " + token } : {}) },
    body:data === undefined ? undefined : JSON.stringify(data)
  })
  return { status:response.status, body:await response.json() }
}
async function login(role, accountId, password) { return api("/auth/login", null, "POST", { role, accountId, password }) }
async function preview(csvText = roster, token = admin, clientBatchId = key()) {
  return api("/admin/import-batches/preview", token, "POST", { format:"student-roster", fileName:"students.csv", clientBatchId, csvText })
}
async function getStudent() { return database.prepare("SELECT * FROM users WHERE account_id = ?").get(accountId) }

test.before(async () => {
  if (process.env.STUDENT_TEST_MYSQL === "1") {
    // Caller must provision an empty disposable database; never use the live DB.
    if (process.env.MYSQL_DATABASE !== "shuzhi_accounts_test") throw new Error("MySQL tests require isolated shuzhi_accounts_test database")
    execFileSync(process.execPath, [path.join(__dirname, "../scripts/mysql-migrate.js")], { stdio:"pipe" })
    database = await openConfiguredDatabase(Object.assign({}, loadConfig(process.env), config, {
      databaseEngine:"mysql", mysqlHost:process.env.MYSQL_HOST, mysqlPort:3306,
      mysqlUser:process.env.MYSQL_USER, mysqlPassword:process.env.MYSQL_PASSWORD, mysqlDatabase:process.env.MYSQL_DATABASE
    }))
  } else database = openDatabase(":memory:")
  await seedDemoData(database)
  server = http.createServer(createHttpApp(createServices(database, config), config))
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  baseUrl = "http://127.0.0.1:" + server.address().port
  admin = (await login("admin", "admin", "123456")).body.data.token
  counselor = (await login("counselor", "T001", "123456")).body.data.token
})
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  if (database) await database.close()
})

test("三列名单、首次完善、改密、人工重置及导入回滚", async t => {
  await t.test("仅管理员可导入；顺序错误、多余姓名列均被拒绝", async () => {
    assert.equal((await preview(roster, counselor)).status, 403)
    for (const csv of ["学号,班级,手机号\n002026001,软件工程1班," + phone, "班级,学号,手机号,姓名\n软件工程1班,002026001," + phone + ",小明"]) {
      assert.equal((await preview(csv)).status, 422)
    }
  })
  await t.test("重复学号和无效手机号阻止整批写入", async () => {
    for (const csv of [roster + "\n软件工程1班," + accountId + ",13912003456", "班级,学号,手机号\n软件工程1班,002026001,123"]) {
      const response = await preview(csv)
      assert.equal(response.body.data.status, "校验失败")
      assert.equal((await api("/admin/import-batches/" + response.body.data.id + "/confirm", admin, "POST", {})).status, 409)
    }
    assert.equal(await getStudent(), undefined)
  })
  await t.test("预检不创建账号、只保存手机号密文与密码摘要", async () => {
    const response = await preview()
    assert.equal(response.status, 201)
    assert.equal(response.body.data.errorCount, 0)
    assert.equal(response.body.data.totalRows, 1)
    batchId = response.body.data.id
    const batch = await database.prepare("SELECT plan_json FROM import_batches WHERE id = ?").get(batchId)
    const plan = JSON.stringify(batch.plan_json)
    assert.ok(!plan.includes(phone))
    assert.ok(!plan.includes(phone.slice(-6)))
    assert.ok(!JSON.stringify(response.body).includes("passwordHash"))
    assert.equal(await getStudent(), undefined)
  })
  await t.test("确认后创建班级，保留学号前导零，姓名为空且初始密码可用", async () => {
    assert.equal((await api("/admin/import-batches/" + batchId + "/confirm", admin, "POST", {})).status, 200)
    const student = await getStudent()
    assert.equal(student.account_id, accountId)
    assert.equal(student.display_name, "")
    assert.match(student.phone_encrypted, /^enc:v1:/)
    const response = await login("student", accountId, phone.slice(-6))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.className, "软件工程1班")
    assert.equal(response.body.data.user.profileCompleted, false)
    assert.equal(response.body.data.user.mustChangePassword, true)
    initialToken = response.body.data.token
    assert.equal((await api("/assessment-tasks", initialToken)).body.error.code, "ACCOUNT_SETUP_REQUIRED")
  })
  await t.test("本人确认后才保存姓名，不能自行改班级或学号", async () => {
    assert.equal((await api("/account/profile", initialToken, "PATCH", { displayName:"自填姓名", consent:false })).status, 422)
    assert.equal((await api("/account/profile", initialToken, "PATCH", { displayName:"自填姓名", consent:true, classId:"CS2401" })).status, 422)
    const response = await api("/account/profile", initialToken, "PATCH", { displayName:"自填姓名", consent:true })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.displayName, "自填姓名")
    assert.ok((await getStudent()).profile_consent_at)
    assert.equal((await api("/assessment-tasks", initialToken)).status, 403)
  })
  await t.test("改密验证原密码，成功后旧会话与旧密码失效", async () => {
    assert.equal((await api("/account/password", initialToken, "POST", { currentPassword:"wrong", newPassword:"StudentNew123" })).status, 422)
    assert.equal((await api("/account/password", initialToken, "POST", { currentPassword:phone.slice(-6), newPassword:"StudentNew123" })).status, 200)
    assert.equal((await api("/account", initialToken)).status, 401)
    assert.equal((await login("student", accountId, phone.slice(-6))).status, 401)
    const response = await login("student", accountId, "StudentNew123")
    studentToken = response.body.data.token
    assert.equal(response.body.data.user.mustChangePassword, false)
    assert.equal((await api("/assessment-tasks", studentToken)).status, 200)
  })
  await t.test("重复导入不改姓名或密码，同内容无变化，旧批次回滚不能覆盖学生修改", async () => {
    const response = await preview()
    assert.equal(response.body.data.updateCount, 0)
    assert.equal(response.body.data.unchangedCount, 1)
    assert.equal((await api("/admin/import-batches/" + response.body.data.id + "/confirm", admin, "POST", {})).status, 200)
    assert.equal((await getStudent()).display_name, "自填姓名")
    assert.equal((await login("student", accountId, "StudentNew123")).status, 200)
    assert.equal((await api("/admin/import-batches/" + batchId + "/rollback", admin, "POST", {})).status, 409)
  })
  await t.test("更新手机号保留现有密码，回滚恢复手机号，按当前登记号重置", async () => {
    const changedPhone = "13955556666"
    const response = await preview(roster.replace(phone, changedPhone))
    assert.equal(response.body.data.updateCount, 1)
    const id = response.body.data.id
    assert.equal((await api("/admin/import-batches/" + id + "/confirm", admin, "POST", {})).status, 200)
    assert.equal((await login("student", accountId, "StudentNew123")).status, 200)
    assert.equal((await api("/admin/import-batches/" + id + "/rollback", admin, "POST", {})).status, 200)
    const protector = createDataProtector(config.dataEncryptionKey)
    const student = await getStudent()
    assert.equal(protector.unprotectText(student.phone_encrypted, "student-phone:" + student.id), phone)
  })
  await t.test("学生与辅导员不能重置密码；管理员重置使旧会话失效", async () => {
    const route = "/admin/students/" + accountId + "/reset-password"
    assert.equal((await api(route, studentToken, "POST", {})).status, 403)
    assert.equal((await api(route, counselor, "POST", {})).status, 403)
    const response = await api(route, admin, "POST", {})
    assert.equal(response.status, 200)
    assert.ok(!JSON.stringify(response.body).includes(phone.slice(-6)))
    assert.equal((await api("/account", studentToken)).status, 401)
    const loginResult = await login("student", accountId, phone.slice(-6))
    assert.equal(loginResult.status, 200)
    assert.equal(loginResult.body.data.user.mustChangePassword, true)
    assert.equal((await api("/assessment-tasks", loginResult.body.data.token)).status, 403)
    const audit = await database.prepare("SELECT * FROM audit_logs WHERE action = '重置学生密码'").all()
    assert.equal(audit.length, 1)
    assert.ok(!JSON.stringify(audit).includes(phone))
  })
  await t.test("导入新名单后可整批回滚，停用账号不能登录", async () => {
    const response = await preview("班级,学号,手机号\n可回滚班级,00990001,13812340000")
    const id = response.body.data.id
    assert.equal((await api("/admin/import-batches/" + id + "/confirm", admin, "POST", {})).status, 200)
    assert.equal((await api("/admin/import-batches/" + id + "/rollback", admin, "POST", {})).status, 200)
    assert.equal((await login("student", "00990001", "340000")).status, 401)
  })
})
