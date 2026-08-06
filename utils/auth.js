const AUTH_SESSION_KEY = "authSession"
const AUTH_ATTEMPTS_KEY = "authLoginAttempts"
const AUTH_AUDIT_KEY = "authAuditLogs"
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 60 * 1000

const ROLE_CONFIG = {
  student: {
    value: "student",
    label: "学生",
    accountLabel: "学号",
    accountPlaceholder: "请输入学号，如 2024001",
    description: "查看个人测评、辅导员与健康内容",
    home: "/pages/index/index"
  },
  counselor: {
    value: "counselor",
    label: "辅导员",
    accountLabel: "工号",
    accountPlaceholder: "请输入辅导员工号，如 T001",
    description: "查看授权班级概况与学生支持摘要",
    home: "/pages/counselor/dashboard"
  },
  admin: {
    value: "admin",
    label: "管理员",
    accountLabel: "管理员账号",
    accountPlaceholder: "请输入管理员账号，如 admin",
    description: "管理学期、人员、任务与内容审核",
    home: "/pages/admin/dashboard"
  }
}

const DEMO_ACCOUNTS = [
  { role: "student", accountId: "2024001", password: "123456", studentId: "2024001", studentName: "张同学", nickName: "张同学", grade: "大二", major: "计算机科学与技术", className: "计科2401", counselor: "王辅导员", counselorPhone: "010-12345678" },
  { role: "student", accountId: "2024002", password: "123456", studentId: "2024002", studentName: "李同学", nickName: "李同学", grade: "大二", major: "计算机科学与技术", className: "计科2401", counselor: "王辅导员", counselorPhone: "010-12345678" },
  { role: "counselor", accountId: "T001", password: "123456", staffId: "T001", name: "王辅导员", nickName: "王老师", department: "计算机学院", classIds: ["CS2401", "AI2401"], avatarUrl: "/images/avatars/avatar_1.png" },
  { role: "admin", accountId: "admin", password: "123456", staffId: "A001", name: "系统管理员", nickName: "系统管理员", department: "学生工作部", avatarUrl: "/images/avatars/avatar_2.png" }
]

function nowTime() {
  return Date.now()
}

function normalizeAccountId(value) {
  return String(value || "").trim().toLowerCase()
}

function clonePublicAccount(account) {
  if (!account) return null
  const result = Object.assign({}, account)
  delete result.password
  return result
}

function getRoleOptions() {
  return Object.keys(ROLE_CONFIG).map(key => Object.assign({}, ROLE_CONFIG[key]))
}

function isKnownRole(role) {
  return !!ROLE_CONFIG[role]
}

function getRoleHome(role) {
  return isKnownRole(role) ? ROLE_CONFIG[role].home : "/pages/login/login"
}

function getStorage(key, fallback) {
  const value = wx.getStorageSync(key)
  return value || fallback
}

function setAppAuthState(user) {
  let app = null
  try { app = getApp() } catch (error) { app = null }
  if (!app || !app.globalData) return
  app.globalData.userInfo = user || null
  app.globalData.isLoggedIn = !!user
  app.globalData.role = user ? user.role : null
}

function appendAudit(action, details) {
  const logs = getStorage(AUTH_AUDIT_KEY, [])
  logs.push({
    id: nowTime(),
    action,
    role: details && details.role ? details.role : "",
    accountId: details && details.accountId ? details.accountId : "",
    reason: details && details.reason ? details.reason : "",
    time: new Date().toLocaleString()
  })
  wx.setStorageSync(AUTH_AUDIT_KEY, logs.slice(-100))
}

function getAttemptId(role, accountId) {
  return role + ":" + normalizeAccountId(accountId)
}

function getAttemptState(role, accountId, currentTime) {
  const attempts = getStorage(AUTH_ATTEMPTS_KEY, {})
  const key = getAttemptId(role, accountId)
  const state = attempts[key] || { count: 0, lockedUntil: 0 }
  if (state.lockedUntil && state.lockedUntil <= currentTime) {
    delete attempts[key]
    wx.setStorageSync(AUTH_ATTEMPTS_KEY, attempts)
    return { count: 0, lockedUntil: 0 }
  }
  return state
}

function clearAttemptState(role, accountId) {
  const attempts = getStorage(AUTH_ATTEMPTS_KEY, {})
  delete attempts[getAttemptId(role, accountId)]
  wx.setStorageSync(AUTH_ATTEMPTS_KEY, attempts)
}

function recordFailure(role, accountId, currentTime) {
  const attempts = getStorage(AUTH_ATTEMPTS_KEY, {})
  const key = getAttemptId(role, accountId)
  const previous = attempts[key] || { count: 0, lockedUntil: 0 }
  const count = previous.count + 1
  const lockedUntil = count >= MAX_FAILED_ATTEMPTS ? currentTime + LOCK_DURATION_MS : 0
  attempts[key] = { count, lockedUntil }
  wx.setStorageSync(AUTH_ATTEMPTS_KEY, attempts)
  return { count, lockedUntil }
}

function authenticate(credentials, currentTime) {
  const timestamp = typeof currentTime === "number" ? currentTime : nowTime()
  const role = credentials && credentials.role
  const accountId = credentials && String(credentials.accountId || "").trim()
  const password = credentials && String(credentials.password || "")

  if (!isKnownRole(role)) return { ok: false, code: "INVALID_ROLE", message: "请选择正确的登录身份" }
  if (!accountId) return { ok: false, code: "EMPTY_ACCOUNT", message: "请输入" + ROLE_CONFIG[role].accountLabel }
  if (!password) return { ok: false, code: "EMPTY_PASSWORD", message: "请输入密码" }

  const attemptState = getAttemptState(role, accountId, timestamp)
  if (attemptState.lockedUntil > timestamp) {
    const retryAfterSeconds = Math.ceil((attemptState.lockedUntil - timestamp) / 1000)
    return { ok: false, code: "LOCKED", message: "连续登录失败次数过多，请 " + retryAfterSeconds + " 秒后重试", retryAfterSeconds }
  }

  const normalizedId = normalizeAccountId(accountId)
  const anyRoleAccount = DEMO_ACCOUNTS.find(item => normalizeAccountId(item.accountId) === normalizedId)
  const account = DEMO_ACCOUNTS.find(item => item.role === role && normalizeAccountId(item.accountId) === normalizedId)
  const passwordMatched = account && account.password === password

  if (!passwordMatched) {
    const failure = recordFailure(role, accountId, timestamp)
    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failure.count)
    const roleMismatch = anyRoleAccount && anyRoleAccount.role !== role
    const message = roleMismatch
      ? "所选身份与该账号不匹配，请切换到" + ROLE_CONFIG[anyRoleAccount.role].label
      : (failure.lockedUntil ? "连续登录失败次数过多，请 60 秒后重试" : "账号或密码错误，还可尝试 " + remainingAttempts + " 次")
    appendAudit("登录失败", { role, accountId, reason: roleMismatch ? "角色不匹配" : "凭据错误" })
    return { ok: false, code: roleMismatch ? "ROLE_MISMATCH" : (failure.lockedUntil ? "LOCKED" : "INVALID_CREDENTIALS"), message, remainingAttempts, retryAfterSeconds: failure.lockedUntil ? 60 : 0 }
  }

  clearAttemptState(role, accountId)
  return { ok: true, account: clonePublicAccount(account) }
}

function makeSessionId(account, timestamp) {
  return [account.role, account.accountId, timestamp, Math.random().toString(36).slice(2, 10)].join("-")
}

function createSession(account, options) {
  if (!account || !isKnownRole(account.role)) throw new Error("无法为未知角色创建会话")
  const timestamp = options && typeof options.now === "number" ? options.now : nowTime()
  const user = clonePublicAccount(account)
  const session = {
    version: 1,
    sessionId: makeSessionId(user, timestamp),
    role: user.role,
    accountId: user.accountId,
    issuedAt: timestamp,
    lastActiveAt: timestamp,
    expiresAt: timestamp + SESSION_DURATION_MS,
    consentAt: options && options.consentAt ? options.consentAt : ""
  }
  wx.setStorageSync("userInfo", user)
  wx.setStorageSync(AUTH_SESSION_KEY, session)
  setAppAuthState(user)
  appendAudit("登录成功", { role: user.role, accountId: user.accountId })
  return { user, session }
}

function clearSession(reason) {
  const user = wx.getStorageSync("userInfo") || {}
  wx.removeStorageSync("userInfo")
  wx.removeStorageSync(AUTH_SESSION_KEY)
  wx.removeStorageSync("backendSession")
  wx.removeStorageSync("pendingAccount")
  setAppAuthState(null)
  if (user.accountId) appendAudit("退出登录", { role: user.role, accountId: user.accountId, reason: reason || "用户主动退出" })
}

function readSession(currentTime) {
  const timestamp = typeof currentTime === "number" ? currentTime : nowTime()
  const session = wx.getStorageSync(AUTH_SESSION_KEY)
  const user = wx.getStorageSync("userInfo")
  if (!session || !user) {
    if (session || user) clearSession("会话数据不完整")
    return { valid: false, code: "NO_SESSION", user: null }
  }
  if (!isKnownRole(session.role) || user.role !== session.role || normalizeAccountId(user.accountId) !== normalizeAccountId(session.accountId)) {
    clearSession("会话数据不一致")
    return { valid: false, code: "INVALID_SESSION", user: null }
  }
  if (!session.expiresAt || session.expiresAt <= timestamp) {
    clearSession("会话已过期")
    return { valid: false, code: "SESSION_EXPIRED", user: null }
  }
  return { valid: true, code: "OK", user, session }
}

function getCurrentUser(currentTime) {
  const result = readSession(currentTime)
  return result.valid ? result.user : null
}

function restoreSession(app, currentTime) {
  const result = readSession(currentTime)
  if (app && app.globalData) {
    app.globalData.userInfo = result.valid ? result.user : null
    app.globalData.isLoggedIn = result.valid
    app.globalData.role = result.valid ? result.user.role : null
  }
  return result
}

function routeToRoleHome(user, options) {
  const role = user && user.role
  const url = getRoleHome(role)
  const navigate = () => {
    if (role === "student") wx.switchTab({ url })
    else wx.reLaunch({ url })
  }
  const delay = options && options.delay ? options.delay : 0
  if (delay) setTimeout(navigate, delay)
  else navigate()
}

function requireRole(expectedRole) {
  const result = readSession()
  if (!result.valid) {
    const title = result.code === "SESSION_EXPIRED" ? "登录已过期，请重新登录" : "请先登录"
    wx.showToast({ title, icon: "none" })
    setTimeout(() => wx.reLaunch({ url: "/pages/login/login" }), 200)
    return null
  }

  const allowedRoles = Array.isArray(expectedRole) ? expectedRole : [expectedRole]
  if (allowedRoles.indexOf(result.user.role) === -1) {
    wx.showToast({ title: "当前账号无权访问该页面", icon: "none" })
    setTimeout(() => routeToRoleHome(result.user), 200)
    return null
  }
  return result.user
}

module.exports = {
  AUTH_SESSION_KEY,
  AUTH_ATTEMPTS_KEY,
  AUTH_AUDIT_KEY,
  SESSION_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MS,
  ROLE_CONFIG,
  DEMO_ACCOUNTS,
  getRoleOptions,
  getRoleHome,
  normalizeAccountId,
  authenticate,
  createSession,
  readSession,
  getCurrentUser,
  restoreSession,
  routeToRoleHome,
  requireRole,
  clearSession
}
