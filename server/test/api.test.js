const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { openDatabase, seedDemoData } = require("../src/database")
const { createServices } = require("../src/services")
const { createHttpApp } = require("../src/app")

const config = {
  authSecret: "automated-test-secret",
  tokenTtlSeconds: 3600,
  maxBodyBytes: 1024 * 1024
}

let database
let server
let baseUrl

test.before(async function() {
  database = openDatabase(":memory:")
  seedDemoData(database)
  const services = createServices(database, config)
  server = http.createServer(createHttpApp(services, config))
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
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

async function login(role, accountId, password) {
  const response = await api("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: role, accountId: accountId, password: password || "123456" })
  })
  assert.equal(response.status, 200)
  return response.body.data
}

function authHeaders(token) {
  return { authorization: "Bearer " + token, "content-type": "application/json" }
}

function resultPayload(overrides) {
  const answers = []
  for (let questionId = 1; questionId <= 20; questionId++) {
    answers.push({ questionId:questionId, selectedIndex:questionId <= 16 ? 3 : 0 })
  }
  return Object.assign({
    submissionId: "client:test-submission-001",
    studentId: "forged-student-id",
    taskId: "101",
    assessmentId: 1,
    assessmentName: "情绪压力量表(SAS)",
    score: 68,
    total: 80,
    normalizedRiskScore: 80,
    stdScore: 20,
    riskLevel: "紧急风险",
    questionnaireVersion: "1.0.0",
    scoringVersion: "2.0.0",
    questionnaireSnapshot: { id: 1, version: "1.0.0", questions: [] },
    scoringSnapshot: { scoringVersion: "2.0.0", thresholds: [] },
    answerSnapshot: answers,
    triggeredRules: [],
    createdAt: "2026-08-06T10:00:00.000Z"
  }, overrides || {})
}

test("后端测评数据闭环", async function(t) {
  await t.test("健康检查无需登录", async function() {
    const response = await api("/health")
    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, "ok")
  })

  await t.test("就绪检查确认数据库可以访问", async function() {
    const response = await api("/ready")
    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, "ready")
    assert.equal(response.body.data.database, "ok")
  })

  await t.test("受保护接口拒绝匿名访问", async function() {
    const response = await api("/api/v1/assessment-tasks")
    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, "AUTH_REQUIRED")
  })

  await t.test("错误凭据不会返回令牌", async function() {
    const response = await api("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "student", accountId: "2024001", password: "wrong" })
    })
    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, "INVALID_CREDENTIALS")
  })

  const student = await login("student", "2024001")
  const counselor = await login("counselor", "T001")
  const admin = await login("admin", "admin")

  await t.test("三类角色返回经过脱敏的身份信息", function() {
    assert.equal(student.user.studentId, "2024001")
    assert.deepEqual(counselor.user.classIds, ["AI2401", "CS2401"])
    assert.equal(admin.user.role, "admin")
    assert.equal(Object.prototype.hasOwnProperty.call(student.user, "passwordHash"), false)
  })

  await t.test("学生只能获取当前班级的固定版本任务", async function() {
    const response = await api("/api/v1/assessment-tasks", { headers: authHeaders(student.token) })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 3)
    assert.equal(response.body.data[0].scoringVersion, "2.0.0")
  })

  await t.test("任务版本不匹配时拒绝提交", async function() {
    const response = await api("/api/v1/assessment-results", {
      method: "POST",
      headers: authHeaders(student.token),
      body: JSON.stringify(resultPayload({ submissionId: "client:version-error", scoringVersion: "1.0.0" }))
    })
    assert.equal(response.status, 422)
    assert.equal(response.body.error.code, "VERSION_MISMATCH")
  })

  await t.test("未开始的任务不能提前提交", async function() {
    const response = await api("/api/v1/assessment-results", {
      method: "POST",
      headers: authHeaders(student.token),
      body: JSON.stringify(resultPayload({ submissionId:"client:inactive-task", taskId:"102", assessmentId:3 }))
    })
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, "TASK_NOT_ACTIVE")
  })

  await t.test("客户端篡改风险分数时由服务器拒绝", async function() {
    const response = await api("/api/v1/assessment-results", {
      method: "POST",
      headers: authHeaders(student.token),
      body: JSON.stringify(resultPayload({ submissionId:"client:tampered-score", normalizedRiskScore:10, stdScore:90, riskLevel:"正常" }))
    })
    assert.equal(response.status, 422)
    assert.equal(response.body.error.code, "SERVER_SCORE_MISMATCH")
  })

  let resultId
  await t.test("学生提交结果后以服务器身份保存并生成风险事件", async function() {
    const response = await api("/api/v1/assessment-results", {
      method: "POST",
      headers: authHeaders(student.token),
      body: JSON.stringify(resultPayload())
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.data.result.studentId, "2024001")
    assert.equal(response.body.data.result.riskLevel, "紧急风险")
    assert.equal(response.body.data.idempotent, false)
    resultId = response.body.data.result.id
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM risk_events WHERE result_id = ?").get(resultId).count, 1)
  })

  await t.test("重复 submissionId 幂等返回且不重复写入", async function() {
    const response = await api("/api/v1/assessment-results", {
      method: "POST",
      headers: authHeaders(student.token),
      body: JSON.stringify(resultPayload())
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.data.idempotent, true)
    assert.equal(response.body.data.result.id, resultId)
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_results").get().count, 1)
  })

  await t.test("学生不能访问辅导员接口", async function() {
    const response = await api("/api/v1/counselor/classes", { headers: authHeaders(student.token) })
    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, "FORBIDDEN")
  })

  await t.test("辅导员实时看到授权班级摘要和风险事件", async function() {
    const classes = await api("/api/v1/counselor/classes", { headers: authHeaders(counselor.token) })
    const csClass = classes.body.data.find(function(item) { return item.id === "CS2401" })
    assert.equal(csClass.completed, 1)
    assert.equal(csClass.highRisk, 1)

    const summary = await api("/api/v1/counselor/classes/CS2401/summary", { headers: authHeaders(counselor.token) })
    const target = summary.body.data.students.find(function(item) { return item.studentId === "2024001" })
    assert.equal(target.riskLevel, "紧急风险")
    assert.equal(Object.prototype.hasOwnProperty.call(target, "answerSnapshot"), false)

    const risks = await api("/api/v1/counselor/risk-events", { headers: authHeaders(counselor.token) })
    assert.equal(risks.body.data.length, 1)
    assert.equal(risks.body.data[0].studentId, "2024001")
  })

  await t.test("辅导员无法越权读取未分配班级", async function() {
    const response = await api("/api/v1/counselor/classes/NOCLASS/summary", { headers: authHeaders(counselor.token) })
    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, "CLASS_SCOPE_DENIED")
  })

  await t.test("辅导员更新风险状态并留下跟进记录", async function() {
    const event = database.prepare("SELECT id FROM risk_events WHERE result_id = ?").get(resultId)
    const response = await api("/api/v1/counselor/risk-events/" + event.id, {
      method: "PATCH",
      headers: authHeaders(counselor.token),
      body: JSON.stringify({ status: "跟进中", followupNote: "已电话联系学生" })
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, "跟进中")
    assert.equal(response.body.data.followupNote, "已电话联系学生")
  })

  await t.test("学生支持摘要不返回原始答案", async function() {
    const response = await api("/api/v1/counselor/students/2024001/summary", { headers: authHeaders(counselor.token) })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.results.length, 1)
    assert.equal(Object.prototype.hasOwnProperty.call(response.body.data.results[0], "answerSnapshot"), false)
  })

  await t.test("管理员切换学期不会修改历史结果归属", async function() {
    const created = await api("/api/v1/admin/semesters", {
      method: "POST",
      headers: authHeaders(admin.token),
      body: JSON.stringify({ id: "2027-1", name: "2027-2028学年第一学期", startDate: "2027-09-01", endDate: "2028-01-20" })
    })
    assert.equal(created.status, 201)
    const switched = await api("/api/v1/admin/semesters/2027-1/current", {
      method: "PATCH",
      headers: authHeaders(admin.token),
      body: "{}"
    })
    assert.equal(switched.status, 200)
    assert.equal(switched.body.data.status, "当前学期")
    assert.equal(database.prepare("SELECT semester_id FROM assessment_results WHERE id = ?").get(resultId).semester_id, "2026-1")
  })

  await t.test("历史学期任务不能继续提交", async function() {
    const response = await api("/api/v1/assessment-results", {
      method: "POST",
      headers: authHeaders(student.token),
      body: JSON.stringify(resultPayload({ submissionId:"client:archived-task" }))
    })
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, "TASK_SEMESTER_INACTIVE")
  })

  await t.test("新学期需显式分配后辅导员才获得班级权限", async function() {
    let response = await api("/api/v1/counselor/classes", { headers: authHeaders(counselor.token) })
    assert.equal(response.body.data.length, 0)
    response = await api("/api/v1/admin/counselor-assignments", {
      method: "POST",
      headers: authHeaders(admin.token),
      body: JSON.stringify({ staffId: "T001", classId: "CS2401", semesterId: "2027-1" })
    })
    assert.equal(response.status, 201)
    response = await api("/api/v1/counselor/classes", { headers: authHeaders(counselor.token) })
    assert.equal(response.body.data.length, 1)
  })

  await t.test("后端连续登录失败会临时锁定账号", async function() {
    let response
    for (let index = 0; index < 5; index++) {
      response = await api("/api/v1/auth/login", {
        method:"POST", headers:{ "content-type":"application/json" },
        body:JSON.stringify({ role:"student", accountId:"not-exists", password:"wrong" })
      })
    }
    assert.equal(response.status, 429)
    assert.equal(response.body.error.code, "ACCOUNT_LOCKED")
  })
})
