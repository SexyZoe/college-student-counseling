const API_BASE_URL_KEY = "backendApiBaseUrl"
const API_ENABLED_KEY = "backendSyncEnabled"
const BACKEND_SESSION_KEY = "backendSession"
const deployment = require("./deployment-config")
const DEFAULT_BASE_URL = deployment.baseUrl

function BackendError(status, code, message, details) {
  this.name = "BackendError"
  this.status = status || 0
  this.code = code || "NETWORK_ERROR"
  this.message = message || "后端服务暂时不可用"
  this.details = details || null
}
BackendError.prototype = Object.create(Error.prototype)
BackendError.prototype.constructor = BackendError

function getSettings() {
  const enabled = wx.getStorageSync(API_ENABLED_KEY)
  return {
    enabled: typeof enabled === "boolean" ? enabled : deployment.enabled,
    baseUrl: String(wx.getStorageSync(API_BASE_URL_KEY) || DEFAULT_BASE_URL).replace(/\/$/, "")
  }
}

function configure(options) {
  if (options && options.baseUrl) wx.setStorageSync(API_BASE_URL_KEY, String(options.baseUrl).replace(/\/$/, ""))
  if (options && options.enabled !== undefined) wx.setStorageSync(API_ENABLED_KEY, !!options.enabled)
  return getSettings()
}

function getSession() {
  return wx.getStorageSync(BACKEND_SESSION_KEY) || null
}

function clearSession() {
  wx.removeStorageSync(BACKEND_SESSION_KEY)
}

function request(options) {
  const settings = getSettings()
  if (!settings.enabled) return Promise.reject(new BackendError(0, "BACKEND_DISABLED", "后端同步尚未启用"))
  const session = getSession()
  if (options.auth !== false && (!session || !session.token)) {
    return Promise.reject(new BackendError(401, "AUTH_REQUIRED", "后端登录会话不存在"))
  }
  return new Promise(function(resolve, reject) {
    const header = Object.assign({ "content-type": "application/json" }, options.header || {})
    if (options.auth !== false) header.Authorization = "Bearer " + session.token
    wx.request({
      url: settings.baseUrl + options.path,
      method: options.method || "GET",
      data: options.data,
      header: header,
      timeout: options.timeout || 5000,
      success: function(response) {
        const body = response.data || {}
        if (response.statusCode >= 200 && response.statusCode < 300 && body.ok !== false) {
          resolve(body.data)
          return
        }
        const error = body.error || {}
        if (error.code === "ACCOUNT_SETUP_REQUIRED") wx.reLaunch({ url:"/pages/account/settings" })
        if (response.statusCode === 401 && options.auth !== false) clearSession()
        reject(new BackendError(response.statusCode, error.code, error.message, error.details))
      },
      fail: function(error) {
        reject(new BackendError(0, "NETWORK_ERROR", error && error.errMsg ? error.errMsg : "无法连接后端服务"))
      }
    })
  })
}

function login(credentials) {
  return request({ path: "/api/v1/auth/login", method: "POST", data: credentials, auth: false }).then(function(result) {
    if (!result || typeof result.token !== "string" || !result.token || !Number.isFinite(result.expiresIn) || result.expiresIn <= 0 || !result.user) {
      clearSession()
      throw new BackendError(502, "INVALID_SESSION", "服务器返回的登录会话无效")
    }
    wx.setStorageSync(BACKEND_SESSION_KEY, {
      token: result.token,
      expiresAt: Date.now() + result.expiresIn * 1000,
      user: result.user
    })
    return result
  })
}

function logout() {
  return request({ path:"/api/v1/auth/logout", method:"POST", data:{} }).then(function(result) {
    clearSession()
    return result
  }, function(error) {
    clearSession()
    throw error
  })
}

function submitAssessmentResult(payload) {
  return request({ path: "/api/v1/assessment-results", method: "POST", data: payload, timeout: 10000 })
}

function getAssessmentTasks() {
  return request({ path: "/api/v1/assessment-tasks" })
}

function getMyResults() {
  return request({ path: "/api/v1/assessment-results/me" })
}

function getCounselorClasses() {
  return request({ path: "/api/v1/counselor/classes" })
}

function getClassSummary(classId) {
  return request({ path: "/api/v1/counselor/classes/" + encodeURIComponent(classId) + "/summary" })
}

function getRiskEvents(status) {
  return request({ path: "/api/v1/counselor/risk-events" + (status ? "?status=" + encodeURIComponent(status) : "") })
}

function updateRiskEvent(id, data) {
  return request({ path: "/api/v1/counselor/risk-events/" + encodeURIComponent(id), method: "PATCH", data: data })
}

function getStudentSupportSummary(studentId) {
  return request({ path: "/api/v1/counselor/students/" + encodeURIComponent(studentId) + "/summary" })
}

function getAdminSemesters() {
  return request({ path: "/api/v1/admin/semesters" })
}

function createAdminSemester(data) {
  return request({ path: "/api/v1/admin/semesters", method:"POST", data:data })
}

function setAdminCurrentSemester(semesterId) {
  return request({ path: "/api/v1/admin/semesters/" + encodeURIComponent(semesterId) + "/current", method:"PATCH", data:{} })
}

function getAdminStudents() {
  return request({ path: "/api/v1/admin/students" })
}

function getAdminAssignments(semesterId) {
  return request({ path: "/api/v1/admin/counselor-assignments" + (semesterId ? "?semesterId=" + encodeURIComponent(semesterId) : "") })
}

function getImportBatches() {
  return request({ path: "/api/v1/admin/import-batches" })
}

function getImportBatch(batchId) {
  return request({ path: "/api/v1/admin/import-batches/" + encodeURIComponent(batchId) })
}

function previewPersonnelImport(data) {
  return request({ path: "/api/v1/admin/import-batches/preview", method:"POST", data:data, timeout:15000 })
}

function confirmImportBatch(batchId) {
  return request({ path: "/api/v1/admin/import-batches/" + encodeURIComponent(batchId) + "/confirm", method:"POST", data:{}, timeout:15000 })
}

function rollbackImportBatch(batchId) {
  return request({ path: "/api/v1/admin/import-batches/" + encodeURIComponent(batchId) + "/rollback", method:"POST", data:{}, timeout:15000 })
}

function getAdminAssessmentTasks() {
  return request({ path:"/api/v1/admin/assessment-tasks" })
}

function createAdminAssessmentTask(data) {
  return request({ path:"/api/v1/admin/assessment-tasks", method:"POST", data:data })
}

function transitionAdminAssessmentTask(taskId, status) {
  return request({ path:"/api/v1/admin/assessment-tasks/" + encodeURIComponent(taskId) + "/status", method:"PATCH", data:{ status:status } })
}

function getMyCounselorContent() {
  return request({ path:"/api/v1/counselor/content-items/mine" })
}

function submitCounselorContent(data) {
  return request({ path:"/api/v1/counselor/content-items", method:"POST", data:data })
}

function getPublishedContent(type) {
  return request({ path:"/api/v1/content-items" + (type ? "?type=" + encodeURIComponent(type) : "") }).then(function(items) {
    const baseUrl = getSettings().baseUrl
    return (items || []).map(function(item) {
      item.media = (item.media || []).map(function(media) {
        return Object.assign({}, media, { url:/^https?:\/\//.test(media.url) ? media.url : baseUrl + media.url })
      })
      return item
    })
  })
}

function getAdminContent(type, status) {
  const query = []
  if (type) query.push("type=" + encodeURIComponent(type))
  if (status) query.push("status=" + encodeURIComponent(status))
  return request({ path:"/api/v1/admin/content-items" + (query.length ? "?" + query.join("&") : "") })
}

function reviewAdminContent(contentId, status, reviewNote) {
  return request({ path:"/api/v1/admin/content-items/" + encodeURIComponent(contentId) + "/review", method:"PATCH", data:{ status:status, reviewNote:reviewNote || "" } })
}

function getAdminAuditLogs(limit) {
  return request({ path:"/api/v1/admin/audit-logs?limit=" + encodeURIComponent(limit || 100) })
}

module.exports = {
  createCounselorAssignment:function(data) { return request({ path:"/api/v1/admin/counselor-assignments", method:"POST", data:data }) },
  getAccount:function() { return request({ path:"/api/v1/account" }) },
  updateStudentProfile:function(data) { return request({ path:"/api/v1/account/profile", method:"PATCH", data:data }) },
  changePassword:function(data) { return request({ path:"/api/v1/account/password", method:"POST", data:data }) },
  resetStudentPassword:function(studentId) { return request({ path:"/api/v1/admin/students/" + encodeURIComponent(studentId) + "/reset-password", method:"POST", data:{} }) },
  API_BASE_URL_KEY: API_BASE_URL_KEY,
  API_ENABLED_KEY: API_ENABLED_KEY,
  BACKEND_SESSION_KEY: BACKEND_SESSION_KEY,
  DEFAULT_BASE_URL: DEFAULT_BASE_URL,
  BackendError: BackendError,
  getSettings: getSettings,
  configure: configure,
  getSession: getSession,
  clearSession: clearSession,
  request: request,
  login: login,
  logout: logout,
  submitAssessmentResult: submitAssessmentResult,
  getAssessmentTasks: getAssessmentTasks,
  getMyResults: getMyResults,
  getCounselorClasses: getCounselorClasses,
  getClassSummary: getClassSummary,
  getRiskEvents: getRiskEvents,
  updateRiskEvent: updateRiskEvent,
  getStudentSupportSummary: getStudentSupportSummary,
  getAdminSemesters: getAdminSemesters,
  createAdminSemester: createAdminSemester,
  setAdminCurrentSemester: setAdminCurrentSemester,
  getAdminStudents: getAdminStudents,
  getAdminAssignments: getAdminAssignments,
  getImportBatches: getImportBatches,
  getImportBatch: getImportBatch,
  previewPersonnelImport: previewPersonnelImport,
  confirmImportBatch: confirmImportBatch,
  rollbackImportBatch: rollbackImportBatch,
  getAdminAssessmentTasks: getAdminAssessmentTasks,
  createAdminAssessmentTask: createAdminAssessmentTask,
  transitionAdminAssessmentTask: transitionAdminAssessmentTask,
  getMyCounselorContent: getMyCounselorContent,
  submitCounselorContent: submitCounselorContent,
  getPublishedContent: getPublishedContent,
  getAdminContent: getAdminContent,
  reviewAdminContent: reviewAdminContent,
  getAdminAuditLogs: getAdminAuditLogs
}
