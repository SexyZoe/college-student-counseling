const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { openDatabase, seedDemoData } = require("../src/database")
const { createServices } = require("../src/services")
const { createHttpApp } = require("../src/app")

const config = { authSecret:"personnel-import-test-secret", tokenTtlSeconds:3600, maxBodyBytes:1024 * 1024, logLevel:"error" }
let database
let server
let baseUrl

test.before(async function() {
  database = openDatabase(":memory:")
  await seedDemoData(database)
  server = http.createServer(createHttpApp(createServices(database, config), config))
  await new Promise(function(resolve) { server.listen(0, "127.0.0.1", resolve) })
  baseUrl = "http://127.0.0.1:" + server.address().port
})

test.after(async function() {
  await new Promise(function(resolve) { server.close(resolve) })
  database.close()
})

async function api(path, options) {
  const response = await fetch(baseUrl + path, options)
  const text = await response.text()
  return { status:response.status, body:text ? JSON.parse(text) : null }
}

async function login(role, accountId, password) {
  return api("/api/v1/auth/login", {
    method:"POST", headers:{ "content-type":"application/json" },
    body:JSON.stringify({ role:role, accountId:accountId, password:password || "123456" })
  })
}

function headers(token) {
  return { authorization:"Bearer " + token, "content-type":"application/json" }
}

function csv(lines) {
  return ["类型,账号,姓名,班级编号,班级名称,专业,学期编号,初始密码"].concat(lines).join("\n")
}

async function preview(token, clientBatchId, content, fileName) {
  return api("/api/v1/admin/import-batches/preview", {
    method:"POST", headers:headers(token),
    body:JSON.stringify({ clientBatchId:clientBatchId, fileName:fileName || "人员导入.csv", csvText:content })
  })
}

test("人员数据导入、确认与整批回滚", async function(t) {
  const adminLogin = await login("admin", "admin")
  const studentLogin = await login("student", "2024001")
  const adminToken = adminLogin.body.data.token
  const studentToken = studentLogin.body.data.token

  const validCsv = csv([
    "班级,,,CS2501,计科2501,计算机科学与技术,,",
    "学生,2025001,新同学,CS2501,,,,StudentPass123",
    "辅导员,t002,赵辅导员,,,,,CounselorPass123",
    "分配,t002,,CS2501,,,2026-1,"
  ])

  await t.test("学生无权预检人员文件", async function() {
    const response = await preview(studentToken, "client:import:forbidden", validCsv)
    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, "FORBIDDEN")
  })

  let batchId
  await t.test("管理员预检仅生成差异，不提前写入正式数据", async function() {
    const response = await preview(adminToken, "client:import:valid-001", validCsv)
    assert.equal(response.status, 201)
    assert.equal(response.body.data.status, "待确认")
    assert.equal(response.body.data.createCount, 4)
    assert.equal(response.body.data.errorCount, 0)
    batchId = response.body.data.id
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM users WHERE account_id = '2025001'").get().count, 0)
  })

  await t.test("预检记录不保存或返回明文初始密码", async function() {
    const stored = database.prepare("SELECT plan_json FROM import_batches WHERE id = ?").get(batchId)
    assert.equal(stored.plan_json.includes("StudentPass123"), false)
    const response = await api("/api/v1/admin/import-batches/" + batchId, { headers:headers(adminToken) })
    assert.equal(JSON.stringify(response.body).includes("CounselorPass123"), false)
    assert.equal(JSON.stringify(response.body).includes("passwordHash"), false)
  })

  await t.test("相同批次编号与文件可幂等返回预检结果", async function() {
    const response = await preview(adminToken, "client:import:valid-001", validCsv)
    assert.equal(response.status, 201)
    assert.equal(response.body.data.id, batchId)
  })

  await t.test("相同批次编号不能替换成另一个文件", async function() {
    const response = await preview(adminToken, "client:import:valid-001", validCsv + "\n")
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, "IMPORT_BATCH_CONFLICT")
  })

  await t.test("确认后在同一事务创建班级、账号和分配关系", async function() {
    const response = await api("/api/v1/admin/import-batches/" + batchId + "/confirm", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, "已导入")
    assert.equal(database.prepare("SELECT active FROM classes WHERE id = 'CS2501'").get().active, 1)
    assert.equal(database.prepare("SELECT class_id FROM users WHERE account_id = '2025001'").get().class_id, "CS2501")
    assert.equal(database.prepare("SELECT active FROM counselor_class_assignments WHERE counselor_user_id = 'counselor-t002' AND class_id = 'CS2501'").get().active, 1)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM import_batch_changes WHERE batch_id = ?").get(batchId).count, 4)
  })

  await t.test("导入账号使用摘要密码并可以正常登录", async function() {
    const student = await login("student", "2025001", "StudentPass123")
    const counselor = await login("counselor", "t002", "CounselorPass123")
    assert.equal(student.status, 200)
    assert.equal(student.body.data.user.classId, "CS2501")
    assert.equal(counselor.status, 200)
    assert.deepEqual(counselor.body.data.user.classIds, ["CS2501"])
  })

  await t.test("管理员查询接口返回新学生和分配关系", async function() {
    const students = await api("/api/v1/admin/students", { headers:headers(adminToken) })
    const assignments = await api("/api/v1/admin/counselor-assignments?semesterId=2026-1", { headers:headers(adminToken) })
    assert.equal(students.body.data.some(function(item) { return item.studentId === "2025001" && item.active }), true)
    assert.equal(assignments.body.data.some(function(item) { return item.staffId === "T002" && item.classId === "CS2501" && item.active }), true)
  })

  await t.test("重复确认已导入批次不会重复写入", async function() {
    const response = await api("/api/v1/admin/import-batches/" + batchId + "/confirm", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(response.status, 200)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM users WHERE account_id = '2025001'").get().count, 1)
  })

  await t.test("整批回滚停用新数据并保留审计痕迹", async function() {
    const response = await api("/api/v1/admin/import-batches/" + batchId + "/rollback", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, "已回滚")
    assert.equal(database.prepare("SELECT active FROM users WHERE account_id = '2025001'").get().active, 0)
    assert.equal(database.prepare("SELECT active FROM classes WHERE id = 'CS2501'").get().active, 0)
    assert.equal(database.prepare("SELECT active FROM counselor_class_assignments WHERE counselor_user_id = 'counselor-t002'").get().active, 0)
    assert.ok(database.prepare("SELECT 1 FROM audit_logs WHERE action = '回滚人员导入' AND target_id = ?").get(String(batchId)))
  })

  await t.test("已回滚批次再次回滚保持幂等", async function() {
    const response = await api("/api/v1/admin/import-batches/" + batchId + "/rollback", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, "已回滚")
  })

  await t.test("已回滚停用的班级和辅导员不能被分配行直接复用", async function() {
    const response = await preview(adminToken, "client:import:inactive-reference", csv([
      "分配,t002,,CS2501,,,2026-1,"
    ]))
    assert.equal(response.status, 201)
    assert.equal(response.body.data.status, "校验失败")
    assert.equal(response.body.data.errors.some(function(item) { return item.field === "班级编号" }), true)
    assert.equal(response.body.data.errors.some(function(item) { return item.field === "账号" }), true)
  })

  await t.test("重复行、弱密码和不存在学期会在预检阶段阻止导入", async function() {
    const invalidCsv = csv([
      "学生,2026001,测试学生,CS2401,,,,short",
      "学生,2026001,重复学生,CS2401,,,,AnotherPass123",
      "分配,t001,,CS2401,,,2099-9,"
    ])
    const response = await preview(adminToken, "client:import:invalid-001", invalidCsv)
    assert.equal(response.status, 201)
    assert.equal(response.body.data.status, "校验失败")
    assert.ok(response.body.data.errorCount >= 3)
    const confirm = await api("/api/v1/admin/import-batches/" + response.body.data.id + "/confirm", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(confirm.status, 409)
    assert.equal(confirm.body.error.code, "IMPORT_NOT_CONFIRMABLE")
  })

  let updateBatchId
  await t.test("预检现有学生时生成更新差异", async function() {
    const updateCsv = csv(["学生,2024002,李同学更新,AI2401,,,,"])
    const response = await preview(adminToken, "client:import:update-001", updateCsv)
    assert.equal(response.status, 201)
    assert.equal(response.body.data.updateCount, 1)
    updateBatchId = response.body.data.id
  })

  await t.test("预检后数据发生变化时拒绝覆盖确认", async function() {
    database.prepare("UPDATE users SET display_name = '并发修改' WHERE account_id = '2024002'").run()
    const response = await api("/api/v1/admin/import-batches/" + updateBatchId + "/confirm", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, "IMPORT_PREVIEW_STALE")
    assert.equal(database.prepare("SELECT display_name FROM users WHERE account_id = '2024002'").get().display_name, "并发修改")
    database.prepare("UPDATE users SET display_name = '李同学' WHERE account_id = '2024002'").run()
  })

  await t.test("更新现有学生后回滚恢复原始快照", async function() {
    let response = await api("/api/v1/admin/import-batches/" + updateBatchId + "/confirm", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(response.status, 200)
    assert.equal(database.prepare("SELECT display_name, class_id FROM users WHERE account_id = '2024002'").get().display_name, "李同学更新")
    response = await api("/api/v1/admin/import-batches/" + updateBatchId + "/rollback", {
      method:"POST", headers:headers(adminToken), body:"{}"
    })
    assert.equal(response.status, 200)
    const restored = database.prepare("SELECT display_name, class_id FROM users WHERE account_id = '2024002'").get()
    assert.equal(restored.display_name, "李同学")
    assert.equal(restored.class_id, "CS2401")
  })
})
