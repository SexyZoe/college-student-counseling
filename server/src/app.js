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
      enforceBrowserOrigin(request)
      enforceRateLimit(limiter, response, "general:" + clientIp, config.generalRateLimitPerMinute || 300)
      const url = requestUrl
      const path = url.pathname.replace(/\/$/, "") || "/"
      if (request.method === "GET" && path === "/") return redirect(response, "/web/")
      if (request.method === "GET" && (path === "/web" || path.startsWith("/web/"))) {
        return serveWebAsset(response, path, config.webRoot)
      }
      const mediaMatch = path.match(/^\/media\/([^/]+)$/)
      if (request.method === "GET" && mediaMatch) {
        const mediaUser = await services.authenticate(readBearerToken(request))
        const asset = await services.getPublishedMedia(mediaMatch[1], mediaUser)
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
        const input = await readJson(request, config.maxBodyBytes)
        if (input.client === "web" && request.headers["x-requested-with"] !== "campus-web") throw new HttpError(403, "CSRF_DENIED", "请通过校园网页登录")
        if (input.client === "web" && config.nodeEnv === "production" && !request.socket.encrypted && !(config.trustProxy && request.headers["x-forwarded-proto"] === "https")) {
          throw new HttpError(400, "HTTPS_REQUIRED", "请使用学校提供的 HTTPS 网址登录")
        }
        const result = await services.login(input)
        if (input.client === "web") {
          setSessionCookie(response, result.token, config)
          return sendOk(response, { user:result.user, expiresIn:result.expiresIn })
        }
        return sendOk(response, result)
      }
      if (request.method === "POST" && path === "/api/v1/auth/logout") {
        const result = await services.logout(readBearerToken(request))
        setSessionCookie(response, "", config)
        return sendOk(response, result)
      }

      if (request.method === "GET" && path === "/api/v1/site") {
        return sendOk(response, { schoolName:config.schoolName || "校园", supportPhone:config.supportPhone || "", supportLocation:config.supportLocation || "", supportHours:config.supportHours || "", privacyContact:config.privacyContact || "", retentionNotice:config.retentionNotice || "由学校在正式运行前明确告知", production:config.nodeEnv === "production" })
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
      if (user.must_change_password) {
        throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED", "请先修改临时密码")
      }
      if (path === "/api/v1/counselor/profile" && ["GET", "PATCH"].includes(request.method)) {
        return sendOk(response, await services.counselorProfile(user, request.method === "PATCH" ? await readJson(request, config.maxBodyBytes) : undefined))
      }
      const registryFilters = Object.fromEntries(url.searchParams)
      if(request.method==='GET'&&path==='/api/v1/holiday-periods')return sendOk(response,await services.listHolidayPeriods(user))
      if(request.method==='POST'&&path==='/api/v1/holiday-periods')return sendOk(response,await services.saveHolidayPeriod(user,await readJson(request,config.maxBodyBytes)),201)
      const holidayPeriod=path.match(/^\/api\/v1\/holiday-periods\/([^/]+)$/)
      if(request.method==='PATCH'&&holidayPeriod)return sendOk(response,await services.saveHolidayPeriod(user,await readJson(request,config.maxBodyBytes),holidayPeriod[1]))
      if(request.method==='GET'&&path==='/api/v1/holiday-departures')return sendOk(response,await services.listHolidayDepartures(user,registryFilters))
      if(request.method==='POST'&&path==='/api/v1/holiday-departures/batch')return sendOk(response,await services.batchHolidayDepartures(user,await readJson(request,config.maxBodyBytes)))
      if(request.method==='POST'&&path==='/api/v1/holiday-departures/evidence'){
        enforceRateLimit(limiter,response,'holiday-image:'+user.id,20)
        return sendOk(response,await services.uploadHolidayEvidence(user,await readBinary(request,2*1024*1024),request.headers['content-type']),201)
      }
      const holidayImage=path.match(/^\/api\/v1\/holiday-departures\/evidence\/([^/]+)$/)
      if(request.method==='GET'&&holidayImage){const result=await services.getHolidayEvidence(user,holidayImage[1]);response.setHeader('Content-Type',result.mimeType);response.setHeader('Content-Disposition','inline; filename=parent-confirmation.'+(result.mimeType==='image/png'?'png':'jpg'));return response.end(Buffer.from(result.base64,'base64'))}
      if(request.method==='POST'&&path==='/api/v1/holiday-departures/export'){
        const result=await services.exportHolidayWorkbook(user,await readJson(request,config.maxBodyBytes));response.setHeader('Content-Type',result.mimeType);response.setHeader('Content-Disposition',"attachment; filename=holiday-departures.xlsx; filename*=UTF-8''"+encodeURIComponent(result.fileName));return response.end(result.buffer)
      }
      const holidayHistory=path.match(/^\/api\/v1\/holiday-departures\/([^/]+)\/versions$/)
      if(request.method==='GET'&&holidayHistory)return sendOk(response,await services.getHolidayDepartureVersions(user,holidayHistory[1],registryFilters))
      const holidayRecord=path.match(/^\/api\/v1\/holiday-departures\/([^/]+)$/)
      if(request.method==='GET'&&holidayRecord)return sendOk(response,await services.getHolidayDeparture(user,holidayRecord[1],registryFilters))
      if(request.method==='PUT'&&holidayRecord)return sendOk(response,await services.saveHolidayDeparture(user,holidayRecord[1],await readJson(request,config.maxBodyBytes)))
      if(request.method==='GET'&&path==='/api/v1/grade-applications')return sendOk(response,await services.listGradeApplications(user,registryFilters))
      if(request.method==='POST'&&path==='/api/v1/grade-applications')return sendOk(response,await services.saveGradeApplication(user,await readJson(request,config.maxBodyBytes)),201)
      const gradeAction=path.match(/^\/api\/v1\/grade-applications\/([^/]+)\/(versions|document)$/)
      if(gradeAction){
        if(request.method==='GET'&&gradeAction[2]==='versions')return sendOk(response,await services.getGradeApplicationVersions(user,gradeAction[1]))
        if(request.method==='GET'&&gradeAction[2]==='document'){
          enforceRateLimit(limiter,response,'grade-document:'+user.id,15)
          const result=await services.exportGradeApplication(user,gradeAction[1],registryFilters)
          if(registryFilters.format==='preview')return sendOk(response,{pages:result.pages,pdfBase64:result.pdfBase64})
          response.setHeader('Content-Type',result.mimeType)
          response.setHeader('Content-Disposition',(registryFilters.preview==='1'?'inline':'attachment')+"; filename=grade-application."+(registryFilters.format||'pdf')+"; filename*=UTF-8''"+encodeURIComponent(result.fileName))
          response.setHeader('X-Frame-Options','SAMEORIGIN')
          response.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'self'")
          return response.end(result.buffer)
        }
      }
      const gradeRecord=path.match(/^\/api\/v1\/grade-applications\/([^/]+)$/)
      if(gradeRecord&&request.method==='GET')return sendOk(response,await services.getGradeApplication(user,gradeRecord[1]))
      if(gradeRecord&&request.method==='PATCH')return sendOk(response,await services.saveGradeApplication(user,await readJson(request,config.maxBodyBytes),gradeRecord[1]))
      if(request.method==='GET'&&path==='/api/v1/committee/classes')return sendOk(response,await services.listCommitteeClasses(user,registryFilters))
      if(request.method==='POST'&&path==='/api/v1/committee/classes')return sendOk(response,await services.saveCommitteeClass(user,await readJson(request,config.maxBodyBytes)),201)
      const committeeClass=path.match(/^\/api\/v1\/committee\/classes\/([^/]+)$/)
      if(request.method==='GET'&&committeeClass)return sendOk(response,await services.getCommitteeClass(user,committeeClass[1]))
      if(request.method==='PATCH'&&committeeClass)return sendOk(response,await services.saveCommitteeClass(user,await readJson(request,config.maxBodyBytes),committeeClass[1]))
      const committeeCopy=path.match(/^\/api\/v1\/committee\/classes\/([^/]+)\/copy$/)
      if(request.method==='POST'&&committeeCopy)return sendOk(response,await services.copyCommitteeClass(user,committeeCopy[1],await readJson(request,config.maxBodyBytes)),201)
      const committeeMembers=path.match(/^\/api\/v1\/committee\/classes\/([^/]+)\/members(?:\/([^/]+))?$/)
      if(committeeMembers&&((request.method==='POST'&&!committeeMembers[2])||(request.method==='PATCH'&&committeeMembers[2])))return sendOk(response,await services.saveCommitteeMember(user,committeeMembers[1],await readJson(request,config.maxBodyBytes),committeeMembers[2]),committeeMembers[2]?200:201)
      if(request.method==='PATCH'&&path==='/api/v1/committee/college-headers')return sendOk(response,await services.saveCommitteeHeaders(user,await readJson(request,config.maxBodyBytes)))
      if(request.method==='POST'&&path==='/api/v1/committee/export/options')return sendOk(response,await services.getCommitteeExportOptions(user,await readJson(request,config.maxBodyBytes)))
      if(request.method==='POST'&&path==='/api/v1/committee/export/preview'){
        enforceRateLimit(limiter,response,'committee-preview:'+user.id,12)
        return sendOk(response,await services.previewCommitteeExport(user,await readJson(request,config.maxBodyBytes)))
      }
      if(request.method==='POST'&&path==='/api/v1/committee/export'){
        const result=await services.exportCommitteeWorkbook(user,await readJson(request,config.maxBodyBytes))
        response.setHeader('Content-Type',result.mimeType)
        response.setHeader('Content-Disposition',"attachment; filename=committee-export."+(result.mimeType==='application/zip'?'zip':'xlsx')+"; filename*=UTF-8''"+encodeURIComponent(result.fileName))
        return response.end(result.buffer)
      }
      if(request.method === "GET" && path === "/api/v1/weekly-ledgers/options")return sendOk(response,await services.getWeeklyOptions(user))
      if(request.method === "GET" && path === "/api/v1/weekly-ledgers")return sendOk(response,await services.listWeeklyLedgers(user,registryFilters))
      const weeklyCalendar=path.match(/^\/api\/v1\/weekly-ledgers\/calendars\/([^/]+)$/)
      if(request.method === "PATCH" && weeklyCalendar)return sendOk(response,await services.saveWeeklyCalendar(user,weeklyCalendar[1],await readJson(request,config.maxBodyBytes)))
      const weeklyVersions=path.match(/^\/api\/v1\/weekly-ledgers\/records\/([^/]+)\/versions$/)
      if(request.method === "GET" && weeklyVersions)return sendOk(response,await services.getWeeklyVersions(user,weeklyVersions[1]))
      const weeklyHistory=path.match(/^\/api\/v1\/weekly-ledgers\/students\/([^/]+)\/history$/)
      if(request.method === "GET" && weeklyHistory)return sendOk(response,await services.getWeeklyHistory(user,weeklyHistory[1]))
      const weeklyStudent=path.match(/^\/api\/v1\/weekly-ledgers\/students\/([^/]+)$/)
      if(request.method === "GET" && weeklyStudent)return sendOk(response,await services.getWeeklyStudent(user,weeklyStudent[1],registryFilters))
      if(request.method === "POST" && weeklyStudent)return sendOk(response,await services.saveWeeklyRecord(user,weeklyStudent[1],await readJson(request,config.maxBodyBytes)))
      if(request.method === "POST" && path === "/api/v1/weekly-ledgers/print")return sendOk(response,await services.printWeeklyLedgers(user,await readJson(request,config.maxBodyBytes)))
      if(request.method === "POST" && path === "/api/v1/weekly-ledgers/export"){
        const buffer=await services.exportWeeklyWorkbook(user,await readJson(request,config.maxBodyBytes))
        response.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response.setHeader("Content-Disposition","attachment; filename=weekly-ledger.xlsx; filename*=UTF-8''"+encodeURIComponent("严重心理问题学生周台账表.xlsx"))
        return response.end(buffer)
      }
      if (request.method === "GET" && path === "/api/v1/talk-records/options") return sendOk(response, await services.getTalkMetadata(user))
      if (request.method === "GET" && path === "/api/v1/talk-records") return sendOk(response, await services.listTalkRecords(user, registryFilters))
      if (request.method === "POST" && path === "/api/v1/talk-records") return sendOk(response, await services.saveTalkRecord(user, await readJson(request, config.maxBodyBytes)), 201)
      const talkDocument = path.match(/^\/api\/v1\/talk-records\/([^/]+)\/document$/)
      if (request.method === "GET" && talkDocument) {
        enforceRateLimit(limiter, response, "talk-document:" + user.id, 15)
        const result = await services.exportTalkDocument(user, talkDocument[1], registryFilters)
        response.setHeader("Content-Type", result.mimeType)
        response.setHeader("Content-Disposition", (registryFilters.preview === "1" ? "inline" : "attachment") + "; filename=talk-form." + (registryFilters.format || "pdf") + "; filename*=UTF-8''" + encodeURIComponent(result.fileName))
        response.setHeader("X-Frame-Options", "SAMEORIGIN")
        response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'self'")
        return response.end(result.buffer)
      }
      const talkRecord = path.match(/^\/api\/v1\/talk-records\/([^/]+)$/)
      if (talkRecord && request.method === "GET") return sendOk(response, await services.getTalkRecord(user, talkRecord[1]))
      if (talkRecord && request.method === "PATCH") return sendOk(response, await services.saveTalkRecord(user, await readJson(request, config.maxBodyBytes), talkRecord[1]))
      if (request.method === "GET" && path === "/api/v1/registry/students") return sendOk(response, await services.listRegistryStudents(user, registryFilters))
      if (request.method === "POST" && path === "/api/v1/registry/students") return sendOk(response, await services.saveRegistryStudent(user, await readJson(request, config.maxBodyBytes)), 201)
      if ((request.method === "GET" || (request.method === "POST" && path.endsWith("/export"))) && ["/api/v1/registry/export", "/api/v1/registry/template"].includes(path)) {
        const buffer = await services.exportRegistryWorkbook(user, request.method === "POST" ? await readJson(request, config.maxBodyBytes) : registryFilters, path.endsWith("/template"))
        response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response.setHeader("Content-Disposition", "attachment; filename=student-registry.xlsx; filename*=UTF-8''" + encodeURIComponent(path.endsWith("/template") ? "学生登记模板.xlsx" : "心理问题学生注册表.xlsx"))
        return response.end(buffer)
      }
      if (["GET", "POST"].includes(request.method) && path === "/api/v1/registry/print") return sendOk(response, await services.printRegistryStudents(user, request.method === "POST" ? await readJson(request, config.maxBodyBytes) : registryFilters))
      if (request.method === "POST" && path === "/api/v1/registry/import/preview") {
        if (!["admin", "counselor"].includes(user.role)) throw new HttpError(403, "FORBIDDEN", "当前账号无权导入")
        return sendOk(response, await services.previewRegistryImport(user, await readBinary(request, 5 * 1024 * 1024), registryFilters), 201)
      }
      const registryConfirm = path.match(/^\/api\/v1\/registry\/import\/([^/]+)\/confirm$/)
      if (request.method === "POST" && registryConfirm) return sendOk(response, await services.confirmRegistryImport(user, registryConfirm[1], await readJson(request, config.maxBodyBytes)))
      const registryStudent = path.match(/^\/api\/v1\/registry\/students\/([^/]+)$/)
      if (registryStudent && request.method === "GET") return sendOk(response, await services.getRegistryStudent(user, registryStudent[1]))
      if (registryStudent && request.method === "PATCH") return sendOk(response, await services.saveRegistryStudent(user, await readJson(request, config.maxBodyBytes), registryStudent[1]))
      if (user.role === "student" && !user.profile_completed) {
        throw new HttpError(403, "ACCOUNT_SETUP_REQUIRED", "请先填写姓名并修改初始密码")
      }
      if (request.method === "GET" && path === "/api/v1/student/catalog") {
        return sendOk(response, await services.getStudentCatalog(user))
      }
      if (request.method === "POST" && path === "/api/v1/student/submissions") {
        return sendOk(response, await services.submitWebAssessment(user, await readJson(request, config.maxBodyBytes)), 201)
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
      const semesterMatch = path.match(/^\/api\/v1\/admin\/semesters\/([^/]+)$/)
      if (request.method === 'PATCH' && semesterMatch) {
        return sendOk(response, await services.updateSemester(user, decodeURIComponent(semesterMatch[1]), await readJson(request, config.maxBodyBytes)))
      }
      if (request.method === "POST" && path === "/api/v1/admin/counselor-assignments") {
        return sendOk(response, await services.createCounselorAssignment(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      if (request.method === "PATCH" && path === "/api/v1/admin/counselor-assignments") {
        return sendOk(response, await services.revokeCounselorAssignment(user, await readJson(request, config.maxBodyBytes)))
      }
      if (request.method === "GET" && path === "/api/v1/admin/counselors") {
        return sendOk(response, await services.listAdminCounselors(user))
      }
      if (request.method === "POST" && path === "/api/v1/admin/counselors") {
        return sendOk(response, await services.createAdminCounselor(user, await readJson(request, config.maxBodyBytes)), 201)
      }
      const counselorResetMatch = path.match(/^\/api\/v1\/admin\/counselors\/([^/]+)\/reset-password$/)
      if (request.method === "POST" && counselorResetMatch) {
        return sendOk(response, await services.resetCounselorPassword(user, decodeURIComponent(counselorResetMatch[1])))
      }
      const counselorStatusMatch = path.match(/^\/api\/v1\/admin\/counselors\/([^/]+)\/status$/)
      if (request.method === "PATCH" && counselorStatusMatch) {
        return sendOk(response, await services.setCounselorStatus(user, decodeURIComponent(counselorStatusMatch[1]), await readJson(request, config.maxBodyBytes)))
      }
      if (request.method === "GET" && path === "/api/v1/admin/classes") {
        return sendOk(response, await services.listAdminClasses(user, url.searchParams.get("semesterId") || ""))
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
    .replace(/\/registry\/import\/(?!preview(?:\/|$))[^/]+/g, "/registry/import/:id")
    .replace(/\/talk-records\/(?!options(?:\/|$))[^/]+/g, "/talk-records/:id")
    .replace(/\/weekly-ledgers\/(students|records|calendars)\/[^/]+/g,"/weekly-ledgers/$1/:id")
    .replace(/\/committee\/classes\/[^/]+(?:\/members\/[^/]+)?/g,'/committee/classes/:id')
    .replace(/\/grade-applications\/[^/]+/g,'/grade-applications/:id')
    .replace(/\/holiday-periods\/[^/]+/g,'/holiday-periods/:id')
    .replace(/\/holiday-departures\/evidence\/[^/]+/g,'/holiday-departures/evidence/:id')
    .replace(/\/holiday-departures\/(?!batch$|export$|evidence$)[^/]+/g,'/holiday-departures/:id')
    .replace(/\/(classes|risk-events|students|counselors|semesters|import-batches)\/[^/]+/g, "/$1/:id") || "/"
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

function setSessionCookie(response, token, config) {
  response.setHeader("Set-Cookie", "campus_session=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + (token ? config.tokenTtlSeconds : 0) + (config.nodeEnv === "production" ? "; Secure" : ""))
}

function enforceBrowserOrigin(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return
  const usesCookie = /(?:^|;\s*)campus_session=/.test(String(request.headers.cookie || ""))
  if ((!usesCookie && request.headers["x-requested-with"] !== "campus-web") || request.headers.authorization) return
  if (request.headers["x-requested-with"] !== "campus-web" || request.headers["sec-fetch-site"] === "cross-site") {
    throw new HttpError(403, "CSRF_DENIED", "请求来源不正确，请重新打开校园网页")
  }
  const origin = request.headers.origin
  if (origin) {
    let host
    try { host = new URL(origin).host } catch (_) { throw new HttpError(403, "CSRF_DENIED", "请求来源不正确") }
    if (host !== request.headers.host) throw new HttpError(403, "CSRF_DENIED", "请求来源不正确")
  }
}

function readBearerToken(request) {
  const authorization = String(request.headers.authorization || "")
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (match) return match[1]
  const cookie = String(request.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith("campus_session="))
  if (cookie && cookie.slice(15)) return cookie.slice(15)
  throw new HttpError(401, "AUTH_REQUIRED", "请先登录")
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
    "/web/registry.js":"registry.js",
    "/web/registry.css":"registry.css",
    "/web/talks.js":"talks.js",
    "/web/weekly.js":"weekly.js",
    "/web/committee.js":"committee.js",
    "/web/applications.js":"applications.js",
    "/web/holidays.js":"holidays.js",
    "/web/styles.css":"styles.css",
    "/web/student.js":"student.js",
    "/web/personality.js":"personality.js",
    "/web/campus.css":"campus.css",
    "/web/miniprogram.css":"miniprogram.css"
  }
  const legacyImage = requestPath.match(/^\/web\/images\/(logo(?:_small)?\.png|banners\/banner_[123]\.png|avatars\/avatar_[123]\.png|articles\/article_(?:growth|mood|anxiety|social|stress|love)\.png)$/)
  const name = files[requestPath] || (legacyImage ? "images/" + legacyImage[1] : null)
  if (!name) throw new HttpError(404, "NOT_FOUND", "页面不存在")
  const root = configuredRoot || pathModule.join(__dirname, "..", "web")
  let body
  try { body = await fs.promises.readFile(pathModule.join(root, name)) }
  catch (error) { throw new HttpError(404, "NOT_FOUND", "Web 管理端资源不存在") }
  response.statusCode = 200
  response.setHeader("Content-Type", name.endsWith(".html") ? "text/html; charset=utf-8" : (name.endsWith(".js") ? "text/javascript; charset=utf-8" : (name.endsWith(".png") ? "image/png" : "text/css; charset=utf-8")))
  response.setHeader("Cache-Control", "no-cache")
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; frame-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
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
  response.setHeader("Cache-Control", "private, no-store")
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
