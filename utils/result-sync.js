const apiClient = require("./api-client")

const PENDING_RESULTS_KEY = "pendingBackendResults"
const FAILED_RESULTS_KEY = "failedBackendResults"
let activeFlush = null

function resultPayload(result) {
  return {
    submissionId: result.submissionId || "client:" + result.studentId + ":" + result.id,
    taskId: result.taskId || "",
    assessmentId: result.assessmentId,
    assessmentName: result.assessmentName,
    score: result.score,
    total: result.total,
    normalizedRiskScore: result.normalizedRiskScore,
    stdScore: result.stdScore,
    riskLevel: result.riskLevel,
    questionnaireVersion: result.questionnaireVersion,
    scoringVersion: result.scoringVersion,
    questionnaireSnapshot: result.questionnaireSnapshot,
    scoringSnapshot: result.scoringSnapshot,
    answerSnapshot: result.answerSnapshot,
    triggeredRules: result.triggeredRules || [],
    createdAt: result.createdAt
  }
}

function pendingResults() {
  return wx.getStorageSync(PENDING_RESULTS_KEY) || []
}

function updateLocalResult(localId, changes) {
  const results = wx.getStorageSync("assessmentResults") || []
  results.forEach(function(item) {
    if (String(item.id) === String(localId)) Object.assign(item, changes)
  })
  wx.setStorageSync("assessmentResults", results)
}

function enqueueResult(result) {
  const queue = pendingResults()
  const submissionId = result.submissionId || "client:" + result.studentId + ":" + result.id
  if (!queue.some(function(item) { return item.submissionId === submissionId })) {
    queue.push({ localId: result.id, submissionId: submissionId, payload: resultPayload(Object.assign({}, result, { submissionId: submissionId })), queuedAt: Date.now(), attempts: 0 })
    wx.setStorageSync(PENDING_RESULTS_KEY, queue)
  }
  updateLocalResult(result.id, { submissionId: submissionId, syncStatus: "pending" })
  flushPendingResults()
  return { queued: true, submissionId: submissionId }
}

function retryable(error) {
  return !error || error.status === 0 || error.status === 401 || error.status >= 500
}

function flushPendingResults() {
  if (activeFlush) return activeFlush
  const settings = apiClient.getSettings()
  const session = apiClient.getSession()
  if (!settings.enabled || !session || !session.token) {
    return Promise.resolve({ synced: 0, failed: 0, pending: pendingResults().length })
  }

  const queue = pendingResults().slice()
  let synced = 0
  let failed = 0
  let chain = Promise.resolve()
  queue.forEach(function(entry) {
    chain = chain.then(function() {
      return apiClient.submitAssessmentResult(entry.payload).then(function(response) {
        const remaining = pendingResults().filter(function(item) { return item.submissionId !== entry.submissionId })
        wx.setStorageSync(PENDING_RESULTS_KEY, remaining)
        updateLocalResult(entry.localId, {
          syncStatus: "synced",
          remoteResultId: response.result.id,
          syncedAt: new Date().toISOString(),
          syncError: ""
        })
        synced++
      }).catch(function(error) {
        if (retryable(error)) {
          const pending = pendingResults()
          pending.forEach(function(item) {
            if (item.submissionId === entry.submissionId) item.attempts = (item.attempts || 0) + 1
          })
          wx.setStorageSync(PENDING_RESULTS_KEY, pending)
          return
        }
        const remaining = pendingResults().filter(function(item) { return item.submissionId !== entry.submissionId })
        wx.setStorageSync(PENDING_RESULTS_KEY, remaining)
        const failedItems = wx.getStorageSync(FAILED_RESULTS_KEY) || []
        failedItems.push(Object.assign({}, entry, { code: error.code, message: error.message, failedAt: Date.now() }))
        wx.setStorageSync(FAILED_RESULTS_KEY, failedItems)
        updateLocalResult(entry.localId, { syncStatus: "failed", syncError: error.code || "SYNC_FAILED" })
        failed++
      })
    })
  })
  activeFlush = chain.then(function() {
    const summary = { synced: synced, failed: failed, pending: pendingResults().length }
    activeFlush = null
    return summary
  }, function(error) {
    activeFlush = null
    throw error
  })
  return activeFlush
}

module.exports = {
  PENDING_RESULTS_KEY: PENDING_RESULTS_KEY,
  FAILED_RESULTS_KEY: FAILED_RESULTS_KEY,
  resultPayload: resultPayload,
  enqueueResult: enqueueResult,
  flushPendingResults: flushPendingResults
}
