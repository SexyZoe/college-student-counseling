const assert = require("assert")

const storage = Object.create(null)
const calls = []

global.wx = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] },
  request(options) {
    calls.push(options)
    const submissionId = options.data && options.data.submissionId
    if (submissionId === "client:failed") {
      options.success({ statusCode: 422, data: { ok:false, error:{ code:"VERSION_MISMATCH", message:"版本不匹配" } } })
      return
    }
    if (submissionId === "client:offline") {
      options.fail({ errMsg:"request:fail" })
      return
    }
    if (options.url.endsWith("/api/v1/assessment-results/me") && options.header.Authorization === "Bearer revoked-token") {
      options.success({ statusCode:401, data:{ ok:false, error:{ code:"INVALID_TOKEN", message:"登录会话已失效" } } })
      return
    }
    if (options.url.endsWith("/api/v1/auth/login")) {
      options.success({ statusCode:200, data:{ ok:true, data:{ token:"token-1", expiresIn:3600, user:{ role:"student" } } } })
      return
    }
    options.success({ statusCode:201, data:{ ok:true, data:{ result:{ id:99 }, idempotent:false } } })
  }
}

const apiClient = require("../utils/api-client")
const resultSync = require("../utils/result-sync")

function reset() {
  Object.keys(storage).forEach(key => delete storage[key])
  calls.length = 0
}

function sampleResult(id, submissionId) {
  return {
    id:id, submissionId:submissionId, studentId:"2024001", taskId:101,
    assessmentId:1, assessmentName:"测试", score:40, total:80,
    normalizedRiskScore:33, stdScore:67, riskLevel:"正常",
    questionnaireVersion:"1.0.0", scoringVersion:"2.0.0",
    questionnaireSnapshot:{ id:1 }, scoringSnapshot:{ scoringVersion:"2.0.0" },
    answerSnapshot:[], triggeredRules:[], createdAt:"2026-08-06T00:00:00.000Z"
  }
}

async function test(name, callback) {
  reset()
  await callback()
  console.log("✓", name)
}

;(async function() {
  await test("后端默认关闭，不会产生意外网络请求", async function() {
    await assert.rejects(apiClient.getAssessmentTasks(), error => error.code === "BACKEND_DISABLED")
    assert.strictEqual(calls.length, 0)
  })

  await test("启用后端后登录令牌安全存入独立会话", async function() {
    apiClient.configure({ enabled:true, baseUrl:"http://127.0.0.1:8787/" })
    const response = await apiClient.login({ role:"student", accountId:"2024001", password:"123456" })
    assert.strictEqual(response.user.role, "student")
    assert.strictEqual(storage.backendSession.token, "token-1")
    assert.strictEqual(apiClient.getSettings().baseUrl, "http://127.0.0.1:8787")
  })

  await test("退出登录会通知后端并清除本地令牌", async function() {
    apiClient.configure({ enabled:true })
    storage.backendSession = { token:"token-logout" }
    await apiClient.logout()
    assert.strictEqual(storage.backendSession, undefined)
    assert.strictEqual(calls[0].url.endsWith("/api/v1/auth/logout"), true)
    assert.strictEqual(calls[0].header.Authorization, "Bearer token-logout")
  })

  await test("服务端令牌失效时自动清除本地后端会话", async function() {
    apiClient.configure({ enabled:true })
    storage.backendSession = { token:"revoked-token" }
    await assert.rejects(apiClient.getMyResults(), error => error.code === "INVALID_TOKEN")
    assert.strictEqual(storage.backendSession, undefined)
  })

  await test("管理员任务与内容审核客户端使用受保护接口", async function() {
    apiClient.configure({ enabled:true })
    storage.backendSession = { token:"admin-token" }
    await apiClient.createAdminAssessmentTask({ title:"测试任务" })
    await apiClient.transitionAdminAssessmentTask("task-1", "进行中")
    await apiClient.getAdminContent("civics", "待审核")
    await apiClient.reviewAdminContent(7, "已发布", "通过")
    assert.strictEqual(calls[0].url.endsWith("/api/v1/admin/assessment-tasks"), true)
    assert.strictEqual(calls[1].method, "PATCH")
    assert.strictEqual(calls[2].url.includes("status=%E5%BE%85%E5%AE%A1%E6%A0%B8"), true)
    assert.strictEqual(calls[3].url.endsWith("/api/v1/admin/content-items/7/review"), true)
  })

  await test("离线结果进入队列，登录后可幂等同步并回写远端编号", async function() {
    storage.assessmentResults = [sampleResult(1, "client:success")]
    resultSync.enqueueResult(storage.assessmentResults[0])
    assert.strictEqual(storage.pendingBackendResults.length, 1)
    apiClient.configure({ enabled:true })
    storage.backendSession = { token:"token-1" }
    const summary = await resultSync.flushPendingResults()
    assert.strictEqual(summary.synced, 1)
    assert.strictEqual(storage.pendingBackendResults.length, 0)
    assert.strictEqual(storage.assessmentResults[0].syncStatus, "synced")
    assert.strictEqual(storage.assessmentResults[0].remoteResultId, 99)
  })

  await test("不可重试的版本错误转入失败队列", async function() {
    apiClient.configure({ enabled:true })
    storage.backendSession = { token:"token-1" }
    storage.assessmentResults = [sampleResult(2, "client:failed")]
    resultSync.enqueueResult(storage.assessmentResults[0])
    const summary = await resultSync.flushPendingResults()
    assert.strictEqual(summary.failed, 1)
    assert.strictEqual(storage.failedBackendResults[0].code, "VERSION_MISMATCH")
    assert.strictEqual(storage.assessmentResults[0].syncStatus, "failed")
  })

  await test("网络错误保留队列等待下次重试", async function() {
    apiClient.configure({ enabled:true })
    storage.backendSession = { token:"token-1" }
    storage.assessmentResults = [sampleResult(3, "client:offline")]
    resultSync.enqueueResult(storage.assessmentResults[0])
    const summary = await resultSync.flushPendingResults()
    assert.strictEqual(summary.pending, 1)
    assert.strictEqual(storage.pendingBackendResults[0].attempts, 1)
    assert.strictEqual(storage.assessmentResults[0].syncStatus, "pending")
  })

  await test("离线队列超过五十条时不会静默丢失旧结果", async function() {
    storage.assessmentResults = []
    for (let index = 1; index <= 51; index++) {
      const result = sampleResult(index, "client:queue-" + index)
      storage.assessmentResults.push(result)
      resultSync.enqueueResult(result)
    }
    assert.strictEqual(storage.pendingBackendResults.length, 51)
    assert.strictEqual(storage.pendingBackendResults[0].submissionId, "client:queue-1")
  })

  console.log("\n后端同步客户端测试全部通过")
})().catch(function(error) {
  console.error(error)
  process.exitCode = 1
})
