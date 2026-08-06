const CURRENT_STATUS = "当前学期"
const ARCHIVED_STATUS = "已归档"
const UPCOMING_STATUS = "未开始"

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false
  const parts = value.split("-").map(Number)
  const parsed = new Date(parts[0], parts[1] - 1, parts[2])
  return parsed.getFullYear() === parts[0] && parsed.getMonth() === parts[1] - 1 && parsed.getDate() === parts[2]
}

function appendLog(action, details, now) {
  const time = (now || new Date()).toISOString()
  const history = wx.getStorageSync("semesterHistory") || []
  history.push(Object.assign({ id: Date.now(), action: action, time: time }, details || {}))
  wx.setStorageSync("semesterHistory", history)

  const auditLogs = wx.getStorageSync("auditLogs") || []
  auditLogs.push({ id: Date.now() + 1, operator: "系统管理员", action: action, time: time })
  wx.setStorageSync("auditLogs", auditLogs)
}

function ensureSemesterState() {
  const semesters = clone(wx.getStorageSync("semesters") || [])
  let currentId = wx.getStorageSync("currentSemesterId")
  let current = semesters.find(function(item) { return item.id === currentId })
  if (!current) current = semesters.find(function(item) { return item.status === CURRENT_STATUS })
  if (!current && semesters.length) current = semesters[0]

  if (current) {
    currentId = current.id
    semesters.forEach(function(item) {
      if (item.id === currentId) item.status = CURRENT_STATUS
      else if (item.status === CURRENT_STATUS) item.status = ARCHIVED_STATUS
      else if (item.status === "未启用") item.status = UPCOMING_STATUS
    })
    wx.setStorageSync("currentSemesterId", currentId)
    wx.setStorageSync("semesters", semesters)
  }
  return semesters
}

function getSemesters() {
  return ensureSemesterState()
}

function getCurrentSemester() {
  const semesters = ensureSemesterState()
  const currentId = wx.getStorageSync("currentSemesterId")
  const current = semesters.find(function(item) { return item.id === currentId })
  return current ? clone(current) : null
}

function createSemester(input, options) {
  const name = String(input.name || "").trim()
  const startDate = String(input.startDate || "").trim()
  const endDate = String(input.endDate || "").trim()
  if (!name) return { ok: false, message: "请输入学期名称" }
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return { ok: false, message: "请填写正确的开始和结束日期" }
  if (startDate > endDate) return { ok: false, message: "结束日期不能早于开始日期" }

  const semesters = ensureSemesterState()
  if (semesters.some(function(item) { return item.name === name })) {
    return { ok: false, message: "该学期已存在" }
  }
  const now = options && options.now ? options.now : new Date()
  const id = options && options.id ? options.id : "semester-" + now.getTime()
  const semester = { id: id, name: name, status: UPCOMING_STATUS, startDate: startDate, endDate: endDate, createdAt: now.toISOString() }
  semesters.unshift(semester)
  wx.setStorageSync("semesters", semesters)
  appendLog("创建学期 " + name, { semesterId: id }, now)
  return { ok: true, semester: clone(semester), semesters: clone(semesters) }
}

function setCurrentSemester(id, options) {
  const semesters = ensureSemesterState()
  const target = semesters.find(function(item) { return item.id === id })
  if (!target) return { ok: false, message: "未找到该学期" }
  const previousId = wx.getStorageSync("currentSemesterId") || ""
  if (previousId === id) return { ok: true, semester: clone(target), semesters: clone(semesters), unchanged: true }

  semesters.forEach(function(item) {
    if (item.id === id) item.status = CURRENT_STATUS
    else if (item.id === previousId || item.status === CURRENT_STATUS) item.status = ARCHIVED_STATUS
  })
  wx.setStorageSync("semesters", semesters)
  wx.setStorageSync("currentSemesterId", id)
  const now = options && options.now ? options.now : new Date()
  appendLog("切换当前学期为 " + target.name, { semesterId: id, previousSemesterId: previousId }, now)
  return { ok: true, semester: clone(target), semesters: clone(semesters), previousSemesterId: previousId }
}

function getSemesterSnapshot(id) {
  const semesters = ensureSemesterState()
  const semester = id
    ? semesters.find(function(item) { return item.id === id })
    : getCurrentSemester()
  if (!semester) return { id: "", name: "未关联学期" }
  return { id: semester.id, name: semester.name, startDate: semester.startDate, endDate: semester.endDate }
}

module.exports = {
  CURRENT_STATUS: CURRENT_STATUS,
  ARCHIVED_STATUS: ARCHIVED_STATUS,
  UPCOMING_STATUS: UPCOMING_STATUS,
  ensureSemesterState: ensureSemesterState,
  getSemesters: getSemesters,
  getCurrentSemester: getCurrentSemester,
  createSemester: createSemester,
  setCurrentSemester: setCurrentSemester,
  getSemesterSnapshot: getSemesterSnapshot
}
