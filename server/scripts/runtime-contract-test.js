const assert = require("node:assert/strict")

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "")
const suffix = String(Date.now()).slice(-7)

async function request(path, options) {
  const response = await fetch(baseUrl + path, options)
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (response.status >= 500) throw new Error(path + " 返回 " + response.status + "：" + text)
  return { status:response.status, body:body }
}

async function login(role, accountId, password) {
  const response = await request("/api/v1/auth/login", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ role:role, accountId:accountId, password:password || "123456" })
  })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return response.body.data.token
}

function headers(token) {
  return { authorization:"Bearer " + token, "content-type":"application/json" }
}

async function json(path, method, token, body) {
  return request(path, {
    method:method,
    headers:headers(token),
    body:body === undefined ? undefined : JSON.stringify(body)
  })
}

function assessmentPayload(taskId) {
  const answers = []
  for (let questionId = 1; questionId <= 20; questionId++) {
    answers.push({ questionId:questionId, selectedIndex:questionId <= 16 ? 3 : 0 })
  }
  return {
    submissionId:"contract:" + suffix,
    taskId:taskId,
    assessmentId:1,
    assessmentName:"情绪压力量表(SAS)",
    score:68,
    total:80,
    normalizedRiskScore:80,
    stdScore:20,
    riskLevel:"紧急风险",
    questionnaireVersion:"1.0.0",
    scoringVersion:"2.0.0",
    questionnaireSnapshot:{ id:1, version:"1.0.0", questions:[] },
    answerSnapshot:answers,
    createdAt:new Date().toISOString()
  }
}

function dateOffset(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function main() {
  const studentToken = await login("student", "2024001")
  const adminToken = await login("admin", "admin")
  let response = await json("/api/v1/admin/counselors/T001/reset-password", "POST", adminToken, {})
  assert.equal(response.status, 200)
  const temporaryCounselorToken = await login("counselor", "T001", "123456")
  const counselorPassword = "ContractCounselor" + suffix
  response = await json("/api/v1/account/password", "POST", temporaryCounselorToken, {
    currentPassword:"123456", newPassword:counselorPassword
  })
  assert.equal(response.status, 200)
  const counselorToken = await login("counselor", "T001", counselorPassword)

  const semesterId = "contract-sem-" + suffix
  response = await json("/api/v1/admin/semesters", "POST", adminToken, {
    id:semesterId,
    name:"契约测试学期 " + suffix,
    startDate:dateOffset(-1),
    endDate:dateOffset(30)
  })
  assert.equal(response.status, 201)
  response = await json("/api/v1/admin/semesters/" + semesterId + "/current", "PATCH", adminToken, {})
  assert.equal(response.status, 200)
  response = await json("/api/v1/admin/counselor-assignments", "POST", adminToken, {
    staffId:"T001", classId:"CS2401", semesterId:semesterId
  })
  assert.equal(response.status, 201)

  const taskId = "contract-task-" + suffix
  response = await json("/api/v1/admin/assessment-tasks", "POST", adminToken, {
    id:taskId, title:"契约测试任务", assessmentId:1, semesterId:semesterId,
    questionnaireVersion:"1.0.0", scoringVersion:"2.0.0", deadline:dateOffset(7), targetClassId:"CS2401"
  })
  assert.equal(response.status, 201)
  response = await json("/api/v1/admin/assessment-tasks/" + taskId + "/status", "PATCH", adminToken, { status:"进行中" })
  assert.equal(response.status, 200)

  response = await request("/api/v1/semesters/current", { headers:headers(studentToken) })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.id, semesterId)

  response = await request("/api/v1/assessment-tasks", { headers:headers(studentToken) })
  assert.equal(response.status, 200)
  assert.ok(response.body.data.some(function(task) { return task.id === taskId }))

  response = await json("/api/v1/assessment-results", "POST", studentToken, assessmentPayload(taskId))
  assert.equal(response.status, 201)
  assert.equal(response.body.data.result.riskLevel, "紧急风险")

  response = await request("/api/v1/counselor/classes/CS2401/summary", { headers:headers(counselorToken) })
  assert.equal(response.status, 200)
  assert.ok(response.body.data.summary.completed >= 1)

  response = await request("/api/v1/counselor/risk-events?status=待确认", { headers:headers(counselorToken) })
  assert.equal(response.status, 200)
  const event = response.body.data.find(function(item) { return item.studentId === "2024001" })
  assert.ok(event)
  response = await json("/api/v1/counselor/risk-events/" + event.id, "PATCH", counselorToken, {
    status:"跟进中", followupNote:"企业级 MySQL 运行时契约测试记录"
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.status, "跟进中")

  response = await json("/api/v1/counselor/content-items", "POST", counselorToken, {
    type:"civics", title:"契约测试思政内容 " + suffix, category:"测试", summary:"仅供自动化验收", content:"此内容用于验证 MySQL 内容审核事务。"
  })
  assert.equal(response.status, 201)
  const contentId = response.body.data.id
  response = await json("/api/v1/admin/content-items/" + contentId + "/review", "PATCH", adminToken, { status:"已发布", reviewNote:"自动化验收通过" })
  assert.equal(response.status, 200)
  response = await request("/api/v1/content-items?type=civics", { headers:headers(studentToken) })
  assert.equal(response.status, 200)
  assert.ok(response.body.data.some(function(item) { return item.id === contentId }))

  const classId = "CT" + suffix
  const studentId = "9" + suffix
  const counselorId = "T" + suffix
  const csv = [
    "类型,账号,姓名,班级编号,班级名称,专业,学期编号,初始密码",
    "班级,,," + classId + ",契约测试班,软件工程,,",
    "学生," + studentId + ",契约学生," + classId + ",,,,ContractStudent123",
    "辅导员," + counselorId + ",契约辅导员,,,,,ContractCounselor123",
    "分配," + counselorId + ",," + classId + ",,," + semesterId + ","
  ].join("\n")
  response = await json("/api/v1/admin/import-batches/preview", "POST", adminToken, {
    clientBatchId:"contract-import-" + suffix, fileName:"contract.csv", csvText:csv
  })
  assert.equal(response.status, 201)
  assert.equal(response.body.data.errorCount, 0)
  const batchId = response.body.data.id
  response = await json("/api/v1/admin/import-batches/" + batchId + "/confirm", "POST", adminToken, {})
  assert.equal(response.status, 200)
  assert.equal(response.body.data.status, "已导入")
  assert.ok(await login("student", studentId, "ContractStudent123"))
  response = await json("/api/v1/admin/import-batches/" + batchId + "/rollback", "POST", adminToken, {})
  assert.equal(response.status, 200, JSON.stringify(response.body))
  assert.equal(response.body.data.status, "已回滚")

  response = await request("/api/v1/admin/audit-logs?limit=200", { headers:headers(adminToken) })
  assert.equal(response.status, 200)
  assert.ok(response.body.data.some(function(item) { return item.action === "回滚人员导入" }))

  response = await json("/api/v1/admin/semesters/2026-1/current", "PATCH", adminToken, {})
  assert.equal(response.status, 200)
  response = await json("/api/v1/admin/counselors/T001/reset-password", "POST", adminToken, {})
  assert.equal(response.status, 200)

  // Exercise the browser protocol on the same MySQL runtime, not only legacy Bearer requests.
  const browserLogin = await fetch(baseUrl + "/api/v1/auth/login", {
    method:"POST", headers:{ "content-type":"application/json", "X-Requested-With":"campus-web" },
    body:JSON.stringify({ client:"web", role:"student", accountId:"2024001", password:"123456" })
  })
  assert.equal(browserLogin.status, 200)
  const browserCookie = browserLogin.headers.get("set-cookie").split(";")[0]
  const browserHeaders = { cookie:browserCookie, "content-type":"application/json", "X-Requested-With":"campus-web" }
  const catalogResponse = await request("/api/v1/student/catalog", { headers:browserHeaders })
  assert.equal(catalogResponse.status, 200)
  for (const assessment of catalogResponse.body.data.assessments) {
    const payload = {
      submissionId:"browser-contract:" + suffix + ":" + assessment.id,
      assessmentId:assessment.id, questionnaireVersion:assessment.questionnaireVersion,
      scoringVersion:assessment.scoringVersion, consent:true, consentVersion:catalogResponse.body.data.consentVersion,
      answers:Object.fromEntries(assessment.questions.map((q,i) => [i,i%4]))
    }
    const options = { method:"POST", headers:browserHeaders, body:JSON.stringify(payload) }
    const saved = await request("/api/v1/student/submissions", options)
    assert.equal(saved.status, 201, JSON.stringify(saved.body))
    const retry = await request("/api/v1/student/submissions", options)
    assert.equal(retry.body.data.idempotent, true)
    assert.equal(retry.body.data.result.id, saved.body.data.result.id)
  }

  console.log("运行时契约测试通过：强制改密、测评、风险、任务、内容、人员导入回滚、审计及网页Cookie/8套量表提交闭环均正常")
}

main().catch(function(error) {
  console.error("运行时契约测试失败：" + error.stack)
  process.exit(1)
})
