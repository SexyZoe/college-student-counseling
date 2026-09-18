const crypto = require("node:crypto")
const fs = require("node:fs")
const pathModule = require("node:path")
const { HttpError } = require("./errors")
const { createRateLimiter } = require("./rate-limit")
const { createMetrics } = require("./metrics")
const { createLogger } = require("./logger")

function createHttpApp(services, config, options) {
  const limiter = options && options.rateLimiter ? options.rateLimiter : createRateLimiter()
  const metrics = options && options.metrics ? options.metrics : createMetrics()
  const logger = options && options.logger ? options.logger : createLogger(config.logLevel || "info")
  return async function handleRequest(request, response) {
    const requestId = crypto.randomUUID()
    const startedAt = process.hrtime.bigint()
    const requestUrl = new URL(request.url, "http://localhost")
    const route = routeLabel(requestUrl.pathname)
    const clientIp = clientAddress(request, config.trustProxy)
    response.on("finish", function() {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9
      metrics.observe(request.method, route, response.statusCode, durationSeconds)
      logger.info("http_request_completed", {
        requestId:requestId,
        method:request.method,
        route:route,
        status:response.statusCode,
        durationMs:Math.round(durationSeconds * 1000),
        clientIp:clientIp
      })
    })
    setHeaders(request, response, requestId, config)
    if (request.method === "OPTIONS") return send(response, 204, null)

    try {
      enforceRateLimit(limiter, response, "general:" + clientIp, config.generalRateLimitPerMinute || 300)
      const url = requestUrl
      const path = url.pathname.replace(/\/$/, "") || "/"
      if (request.method === "GET" && path === "/") return redirect(response, "/web/")
      if (request.method === "GET" && (path === "/web" || path.startsWith("/web/"))) {
        return serveWebAsset(response, path, config.webRoot)
      }
      const mediaMatch = path.match(/^\/media\/([^/]+)$/)
      if (request.method === "GET" && mediaMatch) {
        const asset = await services.getPublishedMedia(mediaMatch[1])
        if (!asset) throw new HttpError(404, "MEDIA_NOT_FOUND", "媒体文件不存在或尚未发布")
        return streamMedia(request, response, asset)
      }
      if (request.method === "GET" && path === "/health") {
        return sendOk(response, { status: "ok", service: "shuzhi-heart-harbor-server" })
      }
      if (request.method === "GET" && path === "/ready") {
        return sendOk(response, await services.checkReadiness())
      }
      if (request.method === "GET" && path === "/metrics") {
        requireMetricsToken(request, config.metricsToken)
        return sendMetrics(response, metrics.render())
      }
      if (request.method === "POST" && path === "/api/v1/auth/login") {
        enforceRateLimit(limiter, response, "login:" + clientIp, config.loginRateLimitPerMinute || 30)
        return sendOk(response, await services.login(await readJson(request, config.maxBodyBytes)))
      }
      if (request.method === "POST" && path === "/api/v1/auth/logout") {
        return sendOk(response, await services.logout(readBearerToken(request)))
      }

      const user = await services.authenticate(readBearerToken(request))
      if (request.method === "GET" && path === "/api/v1/account") {
        return sendOk(response, await services.getAccount(user))
      }
      if (request.method === "PATCH" && path === "/api/v1/account/profile") {
        return sendOk(response, await services.updateStudentProfile(user, await readJson(request, config.maxBodyBytes)))
      }
      if (request.method === "POST" && path === "/api/v1/account/password") {
        enforceRateLimit(limiter, response, "password:" + user.id, 5)
        return sendOk(response, await services.changePassword(user, await readJson(request, config.maxBodyBytes)))
      }
      if (user.role === "student" && (!user.profile_completed || user.must_change_password)) {
        throw new HttpError(403, "ACCOUNT_SETUP_REQUIRED", "请先填写姓名并修改初始密码")
      }
      const resetMatch = path.match(/^\/api\/v1\/admin\/students\/([^/]+)\/reset-password$/)
      if (request.method === "POST" && resetMatch) {
        return sendOk(response, await services.resetStudentPassword(user, decodeURIComponent(resetMatch[1])))
      }
      if (request.method === "GET" && path === "/api/v1/semesters/current") {
        return sendOk(response, await services.getCurrentSemester())
      }
      if (request.method === "GET" && path === "/api/v1/assessment-tasks") {
        return sendOk(response, await services.listAssessmentTasks(user))
      }
      if (request.method === "POST" && path === "/api/v1/assessment-results") {
        return sendOk(response, await services.submitAssessmentResult(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      if (request.method === "GET" && path === "/api/v1/assessment-results/me") {
        return sendOk(response, await services.getMyResults(user))
      }
      if (request.method === "GET" && path === "/api/v1/content-items") {
        return sendOk(response, await services.listPublishedContent(user, url.searchParams.get("type") || ""))
      }
      if (request.method === "GET" && path === "/api/v1/counselor/classes") {
        return sendOk(response, await services.listCounselorClasses(user))
      }
      const classMatch = path.match(/^\/api\/v1\/counselor\/classes\/([^/]+)\/summary$/)
      if (request.method === "GET" && classMatch) {
        return sendOk(response, await services.classSummary(user, decodeURIComponent(classMatch[1])))
      }
      if (request.method === "GET" && path === "/api/v1/counselor/risk-events") {
        return sendOk(response, await services.listRiskEvents(user, url.searchParams.get("status") || ""))
      }
      const riskMatch = path.match(/^\/api\/v1\/counselor\/risk-events\/(\d+)$/)
      if (request.method === "PATCH" && riskMatch) {
        return sendOk(response, await services.updateRiskEvent(user, Number(riskMatch[1]), await readJson(request, config.maxBodyBytes)))
      }
      const studentMatch = path.match(/^\/api\/v1\/counselor\/students\/([^/]+)\/summary$/)
      if (request.method === "GET" && studentMatch) {
        return sendOk(response, await services.getStudentSupportSummary(user, decodeURIComponent(studentMatch[1])))
      }
      if (request.method === "GET" && path === "/api/v1/counselor/content-items/mine") {
        return sendOk(response, await services.listMyCounselorContent(user))
      }
      if (request.method === "POST" && path === "/api/v1/counselor/media") {
        request.setTimeout(config.mediaUploadTimeoutMs || 300000)
        return sendOk(response, await services.uploadContentMedia(user, {
          fileName:decodeHeader(request.headers["x-file-name"]),
          mimeType:request.headers["content-type"],
          buffer:await readBinary(request, config.maxMediaBytes || 100 * 1024 * 1024)
        }), 201)
      }
      if (request.method === "POST" && path === "/api/v1/counselor/content-items") {
        return sendOk(response, await services.submitCounselorContent(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      if (request.method === "GET" && path === "/api/v1/admin/semesters") {
        return sendOk(response, await services.listSemesters(user))
      }
      if (request.method === "POST" && path === "/api/v1/admin/semesters") {
        return sendOk(response, await services.createSemester(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      const currentSemesterMatch = path.match(/^\/api\/v1\/admin\/semesters\/([^/]+)\/current$/)
      if (request.method === "PATCH" && currentSemesterMatch) {
        return sendOk(response, await services.setCurrentSemester(user, decodeURIComponent(currentSemesterMatch[1])))
      }
      if (request.method === "POST" && path === "/api/v1/admin/counselor-assignments") {
        return sendOk(response, await services.createCounselorAssignment(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      if (request.method === "GET" && path === "/api/v1/admin/students") {
        return sendOk(response, await services.listAdminStudents(user))
      }
      if (request.method === "GET" && path === "/api/v1/admin/counselor-assignments") {
        return sendOk(response, await services.listAdminAssignments(user, url.searchParams.get("semesterId") || ""))
      }
      if (request.method === "GET" && path === "/api/v1/admin/assessment-tasks") {
        return sendOk(response, await services.listAdminAssessmentTasks(user))
      }
      if (request.method === "POST" && path === "/api/v1/admin/assessment-tasks") {
        return sendOk(response, await services.createAdminAssessmentTask(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      const taskStatusMatch = path.match(/^\/api\/v1\/admin\/assessment-tasks\/([^/]+)\/status$/)
      if (request.method === "PATCH" && taskStatusMatch) {
        return sendOk(response, await services.transitionAdminAssessmentTask(user, decodeURIComponent(taskStatusMatch[1]), await readJson(request, config.maxBodyBytes)))
      }
      if (request.method === "GET" && path === "/api/v1/admin/content-items") {
        return sendOk(response, await services.listAdminContent(user, {
          type:url.searchParams.get("type") || "",
          status:url.searchParams.get("status") || ""
        }))
      }
      const contentReviewMatch = path.match(/^\/api\/v1\/admin\/content-items\/(\d+)\/review$/)
      if (request.method === "PATCH" && contentReviewMatch) {
        return sendOk(response, await services.reviewAdminContent(user, Number(contentReviewMatch[1]), await readJson(request, config.maxBodyBytes)))
      }
      if (request.method === "GET" && path === "/api/v1/admin/audit-logs") {
        return sendOk(response, await services.listAdminAuditLogs(user, url.searchParams.get("limit")))
      }
      if (request.method === "GET" && path === "/api/v1/admin/import-batches") {
        return sendOk(response, await services.listImportBatches(user))
      }
      if (request.method === "POST" && path === "/api/v1/admin/import-batches/preview") {
        return sendOk(response, await services.previewPersonnelImport(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      const importBatchMatch = path.match(/^\/api\/v1\/admin\/import-batches\/(\d+)$/)
      if (request.method === "GET" && importBatchMatch) {
        return sendOk(response, await services.getImportBatch(user, Number(importBatchMatch[1])))
      }
      const confirmImportMatch = path.match(/^\/api\/v1\/admin\/import-batches\/(\d+)\/confirm$/)
      if (request.method === "POST" && confirmImportMatch) {
        return sendOk(response, await services.confirmImportBatch(user, Number(confirmImportMatch[1])))
      }
      const rollbackImportMatch = path.match(/^\/api\/v1\/admin\/import-batches\/(\d+)\/rollback$/)
      if (request.method === "POST" && rollbackImportMatch) {
        return sendOk(response, await services.rollbackImportBatch(user, Number(rollbackImportMatch[1])))
      }
      throw new HttpError(404, "NOT_FOUND", "接口不存在")
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR"
      const message = error instanceof HttpError ? error.message : "服务器处理请求失败"
      if (status === 429 && error.details && error.details.retryAfterSeconds) {
        response.setHeader("Retry-After", String(error.details.retryAfterSeconds))
      }
      if (!(error instanceof HttpError)) logger.error("http_request_failed", {
        requestId:requestId,
        errorName:error && error.name,
        errorMessage:error && error.message
      })
      return send(response, status, {
        ok: false,
        error: { code: code, message: message, details: error.details || null },
        requestId: requestId
      })
    }
  }
}

function clientAddress(request, trustProxy) {
  if (trustProxy) {
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim()
    if (forwarded) return forwarded.slice(0, 80)
  }
  return String(request.socket && request.socket.remoteAddress || "unknown").slice(0, 80)
}

function routeLabel(pathname) {
  return String(pathname || "/")
    .replace(/\/$/, "")
    .replace(/\/media\/[^/]+/g, "/media/:id")
    .replace(/\/(classes|risk-events|students|semesters|import-batches)\/[^/]+/g, "/$1/:id") || "/"
}

function enforceRateLimit(limiter, response, key, limit) {
  const result = limiter.check(key, limit, 60 * 1000)
  response.setHeader("X-RateLimit-Limit", String(result.limit))
  response.setHeader("X-RateLimit-Remaining", String(result.remaining))
  if (!result.allowed) {
    throw new HttpError(429, "RATE_LIMITED", "请求过于频繁，请稍后重试", { retryAfterSeconds:result.retryAfterSeconds })
  }
}

function requireMetricsToken(request, expected) {
  if (!expected) return
  const supplied = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "")
  const actualBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new HttpError(401, "METRICS_AUTH_REQUIRED", "监控指标需要授权")
  }
}

function sendMetrics(response, body) {
  response.statusCode = 200
  response.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  response.end(body)
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

function readBinary(request, maxBytes) {
  return new Promise(function(resolve, reject) {
    const declared = Number(request.headers["content-length"] || 0)
    if (declared > maxBytes) return reject(new HttpError(413, "MEDIA_TOO_LARGE", "上传文件超过允许大小"))
    const chunks = []
    let size = 0
    let exceeded = false
    request.on("data", function(chunk) {
      size += chunk.length
      if (size > maxBytes) exceeded = true
      else chunks.push(chunk)
    })
    request.on("end", function() {
      if (exceeded) return reject(new HttpError(413, "MEDIA_TOO_LARGE", "上传文件超过允许大小"))
      resolve(Buffer.concat(chunks))
    })
    request.on("error", reject)
  })
}

function decodeHeader(value) {
  try { return decodeURIComponent(String(value || "")) }
  catch (error) { return String(value || "") }
}

function redirect(response, location) {
  response.statusCode = 302
  response.setHeader("Location", location)
  response.end()
}

async function serveWebAsset(response, requestPath, configuredRoot) {
  const files = {
    "/web":"index.html",
    "/web/":"index.html",
    "/web/index.html":"index.html",
    "/web/app.js":"app.js",
    "/web/styles.css":"styles.css"
  }
  const name = files[requestPath]
  if (!name) throw new HttpError(404, "NOT_FOUND", "页面不存在")
  const root = configuredRoot || pathModule.join(__dirname, "..", "web")
  let body
  try { body = await fs.promises.readFile(pathModule.join(root, name)) }
  catch (error) { throw new HttpError(404, "NOT_FOUND", "Web 管理端资源不存在") }
  response.statusCode = 200
  response.setHeader("Content-Type", name.endsWith(".html") ? "text/html; charset=utf-8" : (name.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8"))
  response.setHeader("Cache-Control", name === "index.html" ? "no-cache" : "public, max-age=3600")
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  response.end(body)
}

async function streamMedia(request, response, asset) {
  let stat
  try { stat = await fs.promises.stat(asset.path) }
  catch (error) { throw new HttpError(404, "MEDIA_NOT_FOUND", "媒体文件不存在") }
  const size = stat.size
  const range = String(request.headers.range || "")
  response.setHeader("Content-Type", asset.mimeType)
  response.setHeader("Accept-Ranges", "bytes")
  response.setHeader("Cache-Control", "public, max-age=86400, immutable")
  response.setHeader("Content-Security-Policy", "default-src 'none'")
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/)
    if (!match) throw new HttpError(416, "RANGE_INVALID", "媒体请求范围不合法")
    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
      response.setHeader("Content-Range", "bytes */" + size)
      throw new HttpError(416, "RANGE_INVALID", "媒体请求范围不合法")
    }
    response.statusCode = 206
    response.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + size)
    response.setHeader("Content-Length", String(end - start + 1))
    return fs.createReadStream(asset.path, { start, end }).pipe(response)
  }
  response.statusCode = 200
  response.setHeader("Content-Length", String(size))
  return fs.createReadStream(asset.path).pipe(response)
}

function setHeaders(request, response, requestId, config) {
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.setHeader("X-Frame-Options", "DENY")
  response.setHeader("Referrer-Policy", "no-referrer")
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
  response.setHeader("X-Request-Id", requestId)
  const origin = String(request.headers.origin || "")
  const allowedOrigins = Array.isArray(config.corsAllowedOrigins) ? config.corsAllowedOrigins : ["*"]
  if (allowedOrigins.indexOf("*") !== -1) {
    response.setHeader("Access-Control-Allow-Origin", "*")
  } else if (origin && allowedOrigins.indexOf(origin) !== -1) {
    response.setHeader("Access-Control-Allow-Origin", origin)
    response.setHeader("Vary", "Origin")
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-File-Name")
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
