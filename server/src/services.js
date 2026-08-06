const crypto = require("node:crypto")
const { HttpError } = require("./errors")
const { inTransaction } = require("./database")
const { normalizeAccountId, verifyPassword, issueToken, verifyToken } = require("./security")
const { createPersonnelImportServices } = require("./personnel-import-service")
const scoringEngine = require("../../utils/scoring-engine")

const ROLES = ["student", "counselor", "admin"]
const RISK_LEVELS = ["正常", "关注", "较高风险", "紧急风险"]
const RISK_SEVERITY = { "正常": 0, "关注": 1, "较高风险": 2, "紧急风险": 3 }
const RISK_STATUSES = ["待确认", "跟进中", "已关闭"]
const QUESTION_COUNTS = { 1:20, 2:20, 3:15, 4:15, 5:12, 6:10, 7:10, 8:12 }

function createServices(database, config, options) {
  const now = options && options.now ? options.now : function() { return Date.now() }

  function nowIso() {
    return new Date(now()).toISOString()
  }

  function audit(actorId, action, targetType, targetId, details) {
    database.prepare(`
      INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(actorId || null, action, targetType || "", String(targetId || ""), JSON.stringify(details || {}), nowIso())
  }

  function currentSemester() {
    return database.prepare("SELECT * FROM semesters WHERE status = '当前学期' LIMIT 1").get() || null
  }

  function requireRole(user, allowedRoles) {
    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
    if (!user || allowed.indexOf(user.role) === -1) {
      throw new HttpError(403, "FORBIDDEN", "当前账号无权执行该操作")
    }
  }

  function publicUser(user) {
    const result = {
      id: user.id,
      role: user.role,
      accountId: user.account_id,
      displayName: user.display_name,
      studentId: user.student_no || "",
      staffId: user.staff_no || "",
      classId: user.class_id || ""
    }
    if (user.role === "counselor") {
      const semester = currentSemester()
      result.classIds = semester ? database.prepare(`
        SELECT class_id FROM counselor_class_assignments
        WHERE counselor_user_id = ? AND semester_id = ? AND active = 1 ORDER BY class_id
      `).all(user.id, semester.id).map(function(row) { return row.class_id }) : []
    }
    return result
  }

  function recordLoginFailure(attemptKey) {
    const timestamp = now()
    const existing = database.prepare("SELECT * FROM auth_login_attempts WHERE attempt_key = ?").get(attemptKey)
    const failureCount = (existing ? existing.failure_count : 0) + 1
    const lockedUntil = failureCount >= 5 ? timestamp + 60 * 1000 : 0
    database.prepare(`
      INSERT INTO auth_login_attempts (attempt_key, failure_count, locked_until, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(attempt_key) DO UPDATE SET
        failure_count = excluded.failure_count,
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
    `).run(attemptKey, failureCount, lockedUntil, nowIso())
    return { failureCount: failureCount, lockedUntil: lockedUntil }
  }

  function login(credentials) {
    const role = credentials && credentials.role
    const accountId = normalizeAccountId(credentials && credentials.accountId)
    const password = String(credentials && credentials.password || "")
    if (ROLES.indexOf(role) === -1 || !accountId || !password) {
      throw new HttpError(400, "INVALID_CREDENTIALS", "请填写正确的身份、账号和密码")
    }
    const attemptKey = role + ":" + accountId
    const attempt = database.prepare("SELECT * FROM auth_login_attempts WHERE attempt_key = ?").get(attemptKey)
    if (attempt && attempt.locked_until > now()) {
      throw new HttpError(429, "ACCOUNT_LOCKED", "登录失败次数过多，请稍后重试", {
        retryAfterSeconds: Math.ceil((attempt.locked_until - now()) / 1000)
      })
    }
    if (attempt && attempt.locked_until && attempt.locked_until <= now()) {
      database.prepare("DELETE FROM auth_login_attempts WHERE attempt_key = ?").run(attemptKey)
    }

    const user = database.prepare("SELECT * FROM users WHERE role = ? AND account_id = ? AND active = 1").get(role, accountId)
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      const failure = recordLoginFailure(attemptKey)
      audit(user ? user.id : null, "登录失败", "account", accountId, { role: role })
      throw new HttpError(failure.lockedUntil ? 429 : 401, failure.lockedUntil ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS", "账号或密码错误")
    }

    database.prepare("DELETE FROM auth_login_attempts WHERE attempt_key = ?").run(attemptKey)
    const token = issueToken(user, { secret: config.authSecret, ttlSeconds: config.tokenTtlSeconds, now: now() })
    audit(user.id, "登录成功", "session", "", { role: role })
    return { token: token, expiresIn: config.tokenTtlSeconds, user: publicUser(user) }
  }

  function authenticate(token) {
    let payload
    try { payload = verifyToken(token, { secret: config.authSecret, now: now() }) }
    catch (error) { throw new HttpError(401, "INVALID_TOKEN", error.message) }
    const user = database.prepare("SELECT * FROM users WHERE id = ? AND active = 1").get(payload.sub)
    if (!user || user.role !== payload.role) throw new HttpError(401, "INVALID_TOKEN", "登录身份已失效")
    return user
  }

  function getCurrentSemester() {
    const semester = currentSemester()
    if (!semester) throw new HttpError(404, "NO_CURRENT_SEMESTER", "当前学期尚未设置")
    return mapSemester(semester)
  }

  function listAssessmentTasks(user) {
    requireRole(user, "student")
    const semester = currentSemester()
    if (!semester || !user.class_id) return []
    return database.prepare(`
      SELECT id, assessment_id, title, semester_id, questionnaire_version, scoring_version, deadline, status, target_class_id
      FROM assessment_tasks
      WHERE semester_id = ? AND (target_class_id IS NULL OR target_class_id = ?)
        AND status IN ('未开始', '进行中')
      ORDER BY deadline, id
    `).all(semester.id, user.class_id).map(mapTask)
  }

  function serializeJson(value, fieldName) {
    if (value === undefined || value === null) throw new HttpError(422, "INVALID_RESULT", fieldName + "不能为空")
    const serialized = JSON.stringify(value)
    if (serialized.length > 512 * 1024) throw new HttpError(413, "SNAPSHOT_TOO_LARGE", fieldName + "超过允许大小")
    return serialized
  }

  function numberInRange(value, min, max, fieldName) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new HttpError(422, "INVALID_RESULT", fieldName + "不合法")
    }
    return parsed
  }

  function submitAssessmentResult(user, payload) {
    requireRole(user, "student")
    payload = payload || {}
    if (!user.student_no || !user.class_id) throw new HttpError(409, "STUDENT_DATA_INCOMPLETE", "学生尚未关联班级")
    const submissionId = String(payload && payload.submissionId || "").trim()
    if (!/^[A-Za-z0-9._:-]{6,128}$/.test(submissionId)) {
      throw new HttpError(422, "INVALID_RESULT", "submissionId 不合法")
    }
    const existing = database.prepare("SELECT * FROM assessment_results WHERE submission_id = ?").get(submissionId)
    if (existing) {
      if (existing.student_user_id !== user.id) throw new HttpError(409, "SUBMISSION_CONFLICT", "提交编号已被占用")
      return { result: mapResultSummary(existing), idempotent: true }
    }

    const assessmentId = parseInt(payload.assessmentId, 10)
    if (!Number.isInteger(assessmentId) || assessmentId < 1 || assessmentId > 8) {
      throw new HttpError(422, "INVALID_RESULT", "assessmentId 不合法")
    }
    const taskId = payload.taskId ? String(payload.taskId) : null
    const task = taskId ? database.prepare("SELECT * FROM assessment_tasks WHERE id = ?").get(taskId) : null
    if (taskId && !task) throw new HttpError(422, "TASK_NOT_FOUND", "测评任务不存在")
    if (task && task.target_class_id && task.target_class_id !== user.class_id) {
      throw new HttpError(403, "TASK_SCOPE_DENIED", "该任务未发布给当前学生")
    }
    if (task && task.assessment_id !== assessmentId) throw new HttpError(422, "VERSION_MISMATCH", "任务与量表不匹配")
    if (task && task.status !== "进行中") throw new HttpError(409, "TASK_NOT_ACTIVE", "测评任务当前不可提交")
    const activeSemester = currentSemester()
    if (task && (!activeSemester || task.semester_id !== activeSemester.id)) {
      throw new HttpError(409, "TASK_SEMESTER_INACTIVE", "该任务不属于当前学期")
    }
    if (task && task.deadline < new Date(now()).toISOString().slice(0, 10)) {
      throw new HttpError(409, "TASK_EXPIRED", "测评任务已超过截止日期")
    }

    const semester = task
      ? database.prepare("SELECT * FROM semesters WHERE id = ?").get(task.semester_id)
      : activeSemester
    if (!semester) throw new HttpError(422, "NO_SEMESTER", "结果无法关联学期")
    const questionnaireVersion = String(payload.questionnaireVersion || "")
    const scoringVersion = String(payload.scoringVersion || "")
    if (!questionnaireVersion || !scoringVersion) throw new HttpError(422, "VERSION_REQUIRED", "必须提交问卷和评分版本")
    if (task && (task.questionnaire_version !== questionnaireVersion || task.scoring_version !== scoringVersion)) {
      throw new HttpError(422, "VERSION_MISMATCH", "提交版本与任务固定版本不一致")
    }

    const serverScore = calculateServerScore(assessmentId, questionnaireVersion, scoringVersion, payload.answerSnapshot)
    const rawScore = numberInRange(payload.score, 0, 10000, "score")
    const maxScore = numberInRange(payload.total, 1, 10000, "total")
    const normalizedRiskScore = numberInRange(payload.normalizedRiskScore, 0, 100, "normalizedRiskScore")
    const wellbeingIndex = numberInRange(payload.stdScore, 0, 100, "stdScore")
    const riskLevel = String(payload.riskLevel || "")
    if (
      rawScore !== serverScore.outcome.rawScore ||
      maxScore !== serverScore.outcome.maxScore ||
      Math.round(normalizedRiskScore) !== serverScore.outcome.normalizedRiskScore ||
      Math.round(wellbeingIndex) !== serverScore.outcome.wellbeingIndex ||
      riskLevel !== serverScore.outcome.riskLevel
    ) {
      throw new HttpError(422, "SERVER_SCORE_MISMATCH", "客户端结果与服务器评分不一致，请重新提交")
    }
    const assessmentName = String(payload.assessmentName || "心理健康测评").trim().slice(0, 100)
    const questionnaireSnapshot = serializeJson(payload.questionnaireSnapshot, "questionnaireSnapshot")
    const scoringSnapshot = serializeJson(serverScore.rule, "scoringSnapshot")
    const answerSnapshot = serializeJson(serverScore.outcome.responseDetails, "answerSnapshot")
    const triggeredRules = serverScore.outcome.triggeredRules
    const triggeredRulesJson = serializeJson(triggeredRules, "triggeredRules")
    const clientCreatedAt = String(payload.createdAt || nowIso())
    if (isNaN(new Date(clientCreatedAt).getTime())) throw new HttpError(422, "INVALID_RESULT", "createdAt 不合法")

    const saved = inTransaction(database, function() {
      const createdAt = nowIso()
      const insert = database.prepare(`
        INSERT INTO assessment_results
          (submission_id, student_user_id, student_no, class_id, task_id, semester_id,
           assessment_id, assessment_name, raw_score, max_score, normalized_risk_score,
           wellbeing_index, risk_level, questionnaire_version, scoring_version,
           questionnaire_snapshot_json, scoring_snapshot_json, answer_snapshot_json,
           triggered_rules_json, client_created_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        submissionId, user.id, user.student_no, user.class_id, task ? task.id : null, semester.id,
        assessmentId, assessmentName, rawScore, maxScore, Math.round(normalizedRiskScore),
        Math.round(wellbeingIndex), riskLevel, questionnaireVersion, scoringVersion,
        questionnaireSnapshot, scoringSnapshot, answerSnapshot, triggeredRulesJson,
        new Date(clientCreatedAt).toISOString(), createdAt
      )
      const resultId = Number(insert.lastInsertRowid)
      if (RISK_SEVERITY[riskLevel] > 0) {
        const summary = triggeredRules.length
          ? "关键题规则已触发，请由有权限人员及时人工复核。"
          : "风险标准分达到关注阈值，请结合实际情况人工复核。"
        database.prepare(`
          INSERT INTO risk_events
            (result_id, student_user_id, class_id, semester_id, level, source, summary, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, '待确认', ?, ?)
        `).run(resultId, user.id, user.class_id, semester.id, riskLevel, task ? task.title : assessmentName, summary, createdAt, createdAt)
      }
      audit(user.id, "提交测评结果", "assessment_result", resultId, { submissionId: submissionId, riskLevel: riskLevel })
      return database.prepare("SELECT * FROM assessment_results WHERE id = ?").get(resultId)
    })
    return { result: mapResultSummary(saved), idempotent: false }
  }

  function getMyResults(user) {
    requireRole(user, "student")
    return database.prepare(`
      SELECT * FROM assessment_results WHERE student_user_id = ? ORDER BY created_at DESC, id DESC
    `).all(user.id).map(mapResultSummary)
  }

  function assertCounselorClass(user, classId, semesterId) {
    requireRole(user, "counselor")
    const semester = semesterId || (currentSemester() || {}).id
    const assignment = semester && database.prepare(`
      SELECT 1 FROM counselor_class_assignments
      WHERE counselor_user_id = ? AND class_id = ? AND semester_id = ? AND active = 1
    `).get(user.id, classId, semester)
    if (!assignment) throw new HttpError(403, "CLASS_SCOPE_DENIED", "无权查看该班级数据")
    return semester
  }

  function classSummary(user, classId) {
    const semester = currentSemester()
    if (!semester) throw new HttpError(404, "NO_CURRENT_SEMESTER", "当前学期尚未设置")
    assertCounselorClass(user, classId, semester.id)
    const classRow = database.prepare("SELECT * FROM classes WHERE id = ? AND active = 1").get(classId)
    if (!classRow) throw new HttpError(404, "CLASS_NOT_FOUND", "班级不存在")
    const rows = database.prepare(`
      WITH ranked AS (
        SELECT ar.*, ROW_NUMBER() OVER (PARTITION BY student_user_id ORDER BY created_at DESC, id DESC) AS row_number
        FROM assessment_results ar WHERE semester_id = ? AND class_id = ?
      )
      SELECT u.student_no, u.display_name, u.class_id, r.id AS result_id,
             r.assessment_name, r.wellbeing_index, r.normalized_risk_score, r.risk_level, r.created_at
      FROM users u
      LEFT JOIN ranked r ON r.student_user_id = u.id AND r.row_number = 1
      WHERE u.role = 'student' AND u.class_id = ? AND u.active = 1
      ORDER BY u.student_no
    `).all(semester.id, classId, classId)
    const students = rows.map(function(row) {
      return {
        studentId: row.student_no,
        studentName: row.display_name,
        classId: row.class_id,
        completion: row.result_id ? "已完成" : "未完成",
        latestScore: row.result_id ? row.wellbeing_index : 0,
        normalizedRiskScore: row.result_id ? row.normalized_risk_score : null,
        riskLevel: row.result_id ? row.risk_level : "未评估",
        latestAssessment: row.assessment_name || "",
        latestAt: row.created_at || ""
      }
    })
    const count = function(level) { return students.filter(function(item) { return item.riskLevel === level }).length }
    const scored = students.filter(function(item) { return item.latestScore > 0 })
    return {
      id: classRow.id,
      name: classRow.name,
      semester: mapSemester(semester),
      summary: {
        total: students.length,
        completed: students.filter(function(item) { return item.completion === "已完成" }).length,
        completionRate: students.length ? Math.round(students.filter(function(item) { return item.completion === "已完成" }).length / students.length * 100) : 0,
        averageWellbeingIndex: scored.length ? Math.round(scored.reduce(function(sum, item) { return sum + item.latestScore }, 0) / scored.length) : 0
      },
      riskDistribution: RISK_LEVELS.concat(["未评估"]).map(function(level) { return { level: level, count: count(level) } }),
      students: students
    }
  }

  function listCounselorClasses(user) {
    requireRole(user, "counselor")
    const semester = currentSemester()
    if (!semester) return []
    const assignments = database.prepare(`
      SELECT c.id FROM counselor_class_assignments a
      JOIN classes c ON c.id = a.class_id
      WHERE a.counselor_user_id = ? AND a.semester_id = ? AND a.active = 1 AND c.active = 1
      ORDER BY c.id
    `).all(user.id, semester.id)
    return assignments.map(function(row) {
      const detail = classSummary(user, row.id)
      return {
        id: detail.id,
        name: detail.name,
        total: detail.summary.total,
        completed: detail.summary.completed,
        rate: detail.summary.completionRate,
        highRisk: detail.students.filter(function(item) { return item.riskLevel === "较高风险" || item.riskLevel === "紧急风险" }).length
      }
    })
  }

  function listRiskEvents(user, status) {
    requireRole(user, "counselor")
    const params = [user.id]
    let statusClause = ""
    if (status) {
      if (RISK_STATUSES.indexOf(status) === -1) throw new HttpError(400, "INVALID_STATUS", "风险状态不合法")
      statusClause = "AND e.status = ?"
      params.push(status)
    }
    return database.prepare(`
      SELECT e.*, u.student_no, u.display_name, c.name AS class_name
      FROM risk_events e
      JOIN counselor_class_assignments a
        ON a.class_id = e.class_id AND a.semester_id = e.semester_id AND a.active = 1
      JOIN users u ON u.id = e.student_user_id
      JOIN classes c ON c.id = e.class_id
      WHERE a.counselor_user_id = ? ${statusClause}
      ORDER BY e.created_at DESC, e.id DESC
    `).all(...params).map(mapRiskEvent)
  }

  function updateRiskEvent(user, eventId, input) {
    requireRole(user, "counselor")
    const event = database.prepare(`
      SELECT e.* FROM risk_events e
      JOIN counselor_class_assignments a
        ON a.class_id = e.class_id AND a.semester_id = e.semester_id AND a.active = 1
      WHERE e.id = ? AND a.counselor_user_id = ?
    `).get(eventId, user.id)
    if (!event) throw new HttpError(404, "RISK_EVENT_NOT_FOUND", "风险事件不存在或无权访问")
    const status = String(input.status || event.status)
    if (RISK_STATUSES.indexOf(status) === -1) throw new HttpError(422, "INVALID_STATUS", "风险状态不合法")
    const note = String(input.followupNote || "").trim().slice(0, 1000)
    database.prepare("UPDATE risk_events SET status = ?, followup_note = ?, updated_at = ? WHERE id = ?")
      .run(status, note, nowIso(), eventId)
    audit(user.id, "更新风险事件", "risk_event", eventId, { status: status })
    return mapRiskEvent(database.prepare(`
      SELECT e.*, u.student_no, u.display_name, c.name AS class_name
      FROM risk_events e JOIN users u ON u.id = e.student_user_id JOIN classes c ON c.id = e.class_id
      WHERE e.id = ?
    `).get(eventId))
  }

  function getStudentSupportSummary(user, studentNo) {
    requireRole(user, "counselor")
    const student = database.prepare("SELECT * FROM users WHERE student_no = ? AND role = 'student' AND active = 1").get(String(studentNo))
    if (!student) throw new HttpError(404, "STUDENT_NOT_FOUND", "学生不存在")
    const current = currentSemester()
    assertCounselorClass(user, student.class_id, current && current.id)
    const results = database.prepare(`
      SELECT ar.* FROM assessment_results ar
      WHERE ar.student_user_id = ? AND EXISTS (
        SELECT 1 FROM counselor_class_assignments a
        WHERE a.counselor_user_id = ? AND a.class_id = ar.class_id
          AND a.semester_id = ar.semester_id AND a.active = 1
      ) ORDER BY ar.created_at DESC, ar.id DESC
    `).all(student.id, user.id).map(mapResultSummary)
    const risk = database.prepare(`
      SELECT e.*, u.student_no, u.display_name, c.name AS class_name
      FROM risk_events e JOIN users u ON u.id = e.student_user_id JOIN classes c ON c.id = e.class_id
      WHERE e.student_user_id = ? AND EXISTS (
        SELECT 1 FROM counselor_class_assignments a
        WHERE a.counselor_user_id = ? AND a.class_id = e.class_id
          AND a.semester_id = e.semester_id AND a.active = 1
      ) ORDER BY e.created_at DESC, e.id DESC LIMIT 1
    `).get(student.id, user.id)
    audit(user.id, "查看学生支持摘要", "student", student.student_no, {})
    return {
      student: { studentId: student.student_no, studentName: student.display_name, classId: student.class_id },
      results: results,
      risk: risk ? mapRiskEvent(risk) : null
    }
  }

  function listSemesters(user) {
    requireRole(user, "admin")
    return database.prepare("SELECT * FROM semesters ORDER BY start_date DESC, id DESC").all().map(mapSemester)
  }

  function createSemester(user, input) {
    requireRole(user, "admin")
    const name = String(input.name || "").trim()
    const startDate = validDate(input.startDate, "startDate")
    const endDate = validDate(input.endDate, "endDate")
    if (!name) throw new HttpError(422, "INVALID_SEMESTER", "学期名称不能为空")
    if (startDate > endDate) throw new HttpError(422, "INVALID_SEMESTER", "结束日期不能早于开始日期")
    const id = String(input.id || "semester-" + crypto.randomUUID()).trim()
    try {
      database.prepare("INSERT INTO semesters (id, name, start_date, end_date, status, created_at) VALUES (?, ?, ?, ?, '未开始', ?)")
        .run(id, name, startDate, endDate, nowIso())
    } catch (error) {
      throw new HttpError(409, "SEMESTER_EXISTS", "学期编号或名称已存在")
    }
    audit(user.id, "创建学期", "semester", id, { name: name })
    return mapSemester(database.prepare("SELECT * FROM semesters WHERE id = ?").get(id))
  }

  function setCurrentSemester(user, semesterId) {
    requireRole(user, "admin")
    const target = database.prepare("SELECT * FROM semesters WHERE id = ?").get(semesterId)
    if (!target) throw new HttpError(404, "SEMESTER_NOT_FOUND", "学期不存在")
    const previous = currentSemester()
    inTransaction(database, function() {
      database.prepare("UPDATE semesters SET status = '已归档' WHERE status = '当前学期' AND id <> ?").run(semesterId)
      database.prepare("UPDATE semesters SET status = '当前学期' WHERE id = ?").run(semesterId)
      audit(user.id, "切换当前学期", "semester", semesterId, { previousSemesterId: previous ? previous.id : "" })
    })
    return mapSemester(database.prepare("SELECT * FROM semesters WHERE id = ?").get(semesterId))
  }

  function createCounselorAssignment(user, input) {
    requireRole(user, "admin")
    const counselor = database.prepare("SELECT * FROM users WHERE staff_no = ? AND role = 'counselor' AND active = 1").get(String(input.staffId || ""))
    const classRow = database.prepare("SELECT * FROM classes WHERE id = ? AND active = 1").get(String(input.classId || ""))
    const semester = database.prepare("SELECT * FROM semesters WHERE id = ?").get(String(input.semesterId || ""))
    if (!counselor || !classRow || !semester) throw new HttpError(422, "INVALID_ASSIGNMENT", "辅导员、班级或学期不存在")
    database.prepare(`
      INSERT INTO counselor_class_assignments (counselor_user_id, class_id, semester_id, active, created_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(counselor_user_id, class_id, semester_id) DO UPDATE SET active = 1
    `).run(counselor.id, classRow.id, semester.id, nowIso())
    audit(user.id, "分配辅导员班级", "class", classRow.id, { counselorId: counselor.id, semesterId: semester.id })
    return { staffId: counselor.staff_no, classId: classRow.id, semesterId: semester.id, active: true }
  }

  const personnelImports = createPersonnelImportServices(database, {
    nowIso:nowIso,
    audit:audit,
    requireRole:requireRole
  })

  return {
    login,
    authenticate,
    getCurrentSemester,
    listAssessmentTasks,
    submitAssessmentResult,
    getMyResults,
    listCounselorClasses,
    classSummary,
    listRiskEvents,
    updateRiskEvent,
    getStudentSupportSummary,
    listSemesters,
    createSemester,
    setCurrentSemester,
    createCounselorAssignment,
    previewPersonnelImport:personnelImports.previewPersonnelImport,
    listImportBatches:personnelImports.listImportBatches,
    getImportBatch:personnelImports.getImportBatch,
    confirmImportBatch:personnelImports.confirmImportBatch,
    rollbackImportBatch:personnelImports.rollbackImportBatch,
    listAdminStudents:personnelImports.listAdminStudents,
    listAdminAssignments:personnelImports.listAdminAssignments
  }
}

function calculateServerScore(assessmentId, questionnaireVersion, scoringVersion, answerSnapshot) {
  let rule
  try { rule = scoringEngine.getRule(assessmentId, scoringVersion) }
  catch (error) { throw new HttpError(422, "VERSION_MISMATCH", error.message) }
  if (questionnaireVersion !== rule.questionnaireVersion) {
    throw new HttpError(422, "VERSION_MISMATCH", "问卷版本与服务器固定版本不一致")
  }
  if (!Array.isArray(answerSnapshot)) throw new HttpError(422, "INVALID_ANSWERS", "答案快照格式不正确")
  const count = QUESTION_COUNTS[assessmentId]
  const byQuestion = Object.create(null)
  answerSnapshot.forEach(function(answer) {
    const questionId = parseInt(answer.questionId, 10)
    const selectedIndex = parseInt(answer.selectedIndex, 10)
    if (!Number.isInteger(questionId) || questionId < 1 || questionId > count || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
      throw new HttpError(422, "INVALID_ANSWERS", "答案索引不合法")
    }
    if (byQuestion[questionId] !== undefined) throw new HttpError(422, "INVALID_ANSWERS", "答案中存在重复题目")
    byQuestion[questionId] = selectedIndex
  })
  const questions = []
  const answers = {}
  for (let questionId = 1; questionId <= count; questionId++) {
    if (byQuestion[questionId] === undefined) throw new HttpError(422, "INVALID_ANSWERS", "答案不完整")
    const reversed = rule.reverseQuestionIds.indexOf(questionId) !== -1
    const scores = reversed ? [4, 3, 2, 1] : [1, 2, 3, 4]
    questions.push({ id:questionId, options:scores.map(function(score) { return { score:score } }) })
    answers[questionId - 1] = byQuestion[questionId]
  }
  const outcome = scoringEngine.scoreAssessment({ assessmentId:assessmentId, questions:questions, answers:answers, rule:rule })
  return { rule:rule, outcome:outcome }
}

function validDate(value, fieldName) {
  const text = String(value || "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new HttpError(422, "INVALID_SEMESTER", fieldName + " 格式不正确")
  const parts = text.split("-").map(Number)
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
    throw new HttpError(422, "INVALID_SEMESTER", fieldName + " 不是有效日期")
  }
  return text
}

function mapSemester(row) {
  return { id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date, status: row.status }
}

function mapTask(row) {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    title: row.title,
    semesterId: row.semester_id,
    questionnaireVersion: row.questionnaire_version,
    scoringVersion: row.scoring_version,
    deadline: row.deadline,
    status: row.status,
    targetClassId: row.target_class_id || ""
  }
}

function mapResultSummary(row) {
  return {
    id: row.id,
    submissionId: row.submission_id,
    studentId: row.student_no,
    classId: row.class_id,
    taskId: row.task_id || "",
    semesterId: row.semester_id,
    assessmentId: row.assessment_id,
    assessmentName: row.assessment_name,
    score: row.raw_score,
    total: row.max_score,
    normalizedRiskScore: row.normalized_risk_score,
    stdScore: row.wellbeing_index,
    riskLevel: row.risk_level,
    questionnaireVersion: row.questionnaire_version,
    scoringVersion: row.scoring_version,
    triggeredRules: JSON.parse(row.triggered_rules_json || "[]"),
    createdAt: row.created_at
  }
}

function mapRiskEvent(row) {
  return {
    id: row.id,
    resultId: row.result_id,
    studentId: row.student_no,
    studentName: row.display_name,
    classId: row.class_id,
    className: row.class_name,
    semesterId: row.semester_id,
    level: row.level,
    source: row.source,
    summary: row.summary,
    status: row.status,
    followupNote: row.followup_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

module.exports = { createServices }
