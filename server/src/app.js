const crypto = require("node:crypto")
const { HttpError } = require("./errors")

function createHttpApp(services, config) {
  return async function handleRequest(request, response) {
    const requestId = crypto.randomUUID()
    setHeaders(response, requestId)
    if (request.method === "OPTIONS") return send(response, 204, null)

    try {
      const url = new URL(request.url, "http://localhost")
      const path = url.pathname.replace(/\/$/, "") || "/"
      if (request.method === "GET" && path === "/health") {
        return sendOk(response, { status: "ok", service: "shuzhi-heart-harbor-server" })
      }
      if (request.method === "POST" && path === "/api/v1/auth/login") {
        return sendOk(response, services.login(await readJson(request, config.maxBodyBytes)))
      }

      const user = services.authenticate(readBearerToken(request))
      if (request.method === "GET" && path === "/api/v1/semesters/current") {
        return sendOk(response, services.getCurrentSemester())
      }
      if (request.method === "GET" && path === "/api/v1/assessment-tasks") {
        return sendOk(response, services.listAssessmentTasks(user))
      }
      if (request.method === "POST" && path === "/api/v1/assessment-results") {
        return sendOk(response, services.submitAssessmentResult(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      if (request.method === "GET" && path === "/api/v1/assessment-results/me") {
        return sendOk(response, services.getMyResults(user))
      }
      if (request.method === "GET" && path === "/api/v1/counselor/classes") {
        return sendOk(response, services.listCounselorClasses(user))
      }
      const classMatch = path.match(/^\/api\/v1\/counselor\/classes\/([^/]+)\/summary$/)
      if (request.method === "GET" && classMatch) {
        return sendOk(response, services.classSummary(user, decodeURIComponent(classMatch[1])))
      }
      if (request.method === "GET" && path === "/api/v1/counselor/risk-events") {
        return sendOk(response, services.listRiskEvents(user, url.searchParams.get("status") || ""))
      }
      const riskMatch = path.match(/^\/api\/v1\/counselor\/risk-events\/(\d+)$/)
      if (request.method === "PATCH" && riskMatch) {
        return sendOk(response, services.updateRiskEvent(user, Number(riskMatch[1]), await readJson(request, config.maxBodyBytes)))
      }
      const studentMatch = path.match(/^\/api\/v1\/counselor\/students\/([^/]+)\/summary$/)
      if (request.method === "GET" && studentMatch) {
        return sendOk(response, services.getStudentSupportSummary(user, decodeURIComponent(studentMatch[1])))
      }
      if (request.method === "GET" && path === "/api/v1/admin/semesters") {
        return sendOk(response, services.listSemesters(user))
      }
      if (request.method === "POST" && path === "/api/v1/admin/semesters") {
        return sendOk(response, services.createSemester(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      const currentSemesterMatch = path.match(/^\/api\/v1\/admin\/semesters\/([^/]+)\/current$/)
      if (request.method === "PATCH" && currentSemesterMatch) {
        return sendOk(response, services.setCurrentSemester(user, decodeURIComponent(currentSemesterMatch[1])))
      }
      if (request.method === "POST" && path === "/api/v1/admin/counselor-assignments") {
        return sendOk(response, services.createCounselorAssignment(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      if (request.method === "GET" && path === "/api/v1/admin/students") {
        return sendOk(response, services.listAdminStudents(user))
      }
      if (request.method === "GET" && path === "/api/v1/admin/counselor-assignments") {
        return sendOk(response, services.listAdminAssignments(user, url.searchParams.get("semesterId") || ""))
      }
      if (request.method === "GET" && path === "/api/v1/admin/import-batches") {
        return sendOk(response, services.listImportBatches(user))
      }
      if (request.method === "POST" && path === "/api/v1/admin/import-batches/preview") {
        return sendOk(response, services.previewPersonnelImport(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      const importBatchMatch = path.match(/^\/api\/v1\/admin\/import-batches\/(\d+)$/)
      if (request.method === "GET" && importBatchMatch) {
        return sendOk(response, services.getImportBatch(user, Number(importBatchMatch[1])))
      }
      const confirmImportMatch = path.match(/^\/api\/v1\/admin\/import-batches\/(\d+)\/confirm$/)
      if (request.method === "POST" && confirmImportMatch) {
        return sendOk(response, services.confirmImportBatch(user, Number(confirmImportMatch[1])))
      }
      const rollbackImportMatch = path.match(/^\/api\/v1\/admin\/import-batches\/(\d+)\/rollback$/)
      if (request.method === "POST" && rollbackImportMatch) {
        return sendOk(response, services.rollbackImportBatch(user, Number(rollbackImportMatch[1])))
      }
      throw new HttpError(404, "NOT_FOUND", "接口不存在")
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR"
      const message = error instanceof HttpError ? error.message : "服务器处理请求失败"
      if (!(error instanceof HttpError)) console.error("[" + requestId + "]", error)
      return send(response, status, {
        ok: false,
        error: { code: code, message: message, details: error.details || null },
        requestId: requestId
      })
    }
  }
}

function readBearerToken(request) {
  const authorization = String(request.headers.authorization || "")
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new HttpError(401, "AUTH_REQUIRED", "请先登录")
  return match[1]
}

function readJson(request, maxBytes) {
  return new Promise(function(resolve, reject) {
    const chunks = []
    let size = 0
    let exceeded = false
    request.on("data", function(chunk) {
      size += chunk.length
      if (size > maxBytes) exceeded = true
      else chunks.push(chunk)
    })
    request.on("end", function() {
      if (exceeded) return reject(new HttpError(413, "BODY_TOO_LARGE", "请求内容超过允许大小"))
      const text = Buffer.concat(chunks).toString("utf8")
      if (!text) return resolve({})
      try { resolve(JSON.parse(text)) }
      catch (error) { reject(new HttpError(400, "INVALID_JSON", "请求内容不是有效 JSON")) }
    })
    request.on("error", reject)
  })
}

function setHeaders(response, requestId) {
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.setHeader("X-Request-Id", requestId)
  response.setHeader("Access-Control-Allow-Origin", "*")
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
}

function sendOk(response, data, status) {
  return send(response, status || 200, { ok: true, data: data })
}

function send(response, status, body) {
  response.statusCode = status
  response.end(body === null ? "" : JSON.stringify(body))
}

module.exports = { createHttpApp }
