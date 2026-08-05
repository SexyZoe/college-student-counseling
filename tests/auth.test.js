const assert = require("assert")

const storage = Object.create(null)
const calls = { toast: [], reLaunch: [], switchTab: [] }

global.wx = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] },
  showToast(options) { calls.toast.push(options) },
  reLaunch(options) { calls.reLaunch.push(options) },
  switchTab(options) { calls.switchTab.push(options) }
}

const app = { globalData: {} }
global.getApp = () => app
global.setTimeout = callback => { callback(); return 1 }

const auth = require("../utils/auth")

function reset() {
  Object.keys(storage).forEach(key => delete storage[key])
  Object.keys(calls).forEach(key => { calls[key].length = 0 })
  app.globalData = {}
}

function test(name, callback) {
  try {
    reset()
    callback()
    console.log("✓", name)
  } catch (error) {
    console.error("✗", name)
    throw error
  }
}

test("提供学生、辅导员和管理员三类角色", () => {
  assert.deepStrictEqual(auth.getRoleOptions().map(item => item.value), ["student", "counselor", "admin"])
})

test("三类演示账号均可通过正确凭据验证", () => {
  const cases = [
    ["student", "2024001"],
    ["counselor", "t001"],
    ["admin", "ADMIN"]
  ]
  cases.forEach(([role, accountId]) => {
    const result = auth.authenticate({ role, accountId, password: "123456" }, 1000)
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.account.role, role)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.account, "password"), false)
  })
})

test("账号身份与所选角色不一致时拒绝登录", () => {
  const result = auth.authenticate({ role: "student", accountId: "T001", password: "123456" }, 1000)
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.code, "ROLE_MISMATCH")
})

test("连续五次凭据错误后临时锁定账号", () => {
  let result
  for (let index = 0; index < 5; index++) {
    result = auth.authenticate({ role: "student", accountId: "2024001", password: "wrong" }, 1000)
  }
  assert.strictEqual(result.code, "LOCKED")
  const locked = auth.authenticate({ role: "student", accountId: "2024001", password: "123456" }, 2000)
  assert.strictEqual(locked.code, "LOCKED")
  const unlocked = auth.authenticate({ role: "student", accountId: "2024001", password: "123456" }, 62000)
  assert.strictEqual(unlocked.ok, true)
})

test("登录成功后创建不含密码的八小时会话", () => {
  const verified = auth.authenticate({ role: "counselor", accountId: "T001", password: "123456" }, 1000)
  const result = auth.createSession(verified.account, { now: 1000, consentAt: "2026-08-05T00:00:00.000Z" })
  assert.strictEqual(result.session.expiresAt, 1000 + auth.SESSION_DURATION_MS)
  assert.strictEqual(result.user.password, undefined)
  assert.strictEqual(app.globalData.role, "counselor")
  assert.strictEqual(auth.readSession(2000).valid, true)
})

test("过期会话会被清理并要求重新登录", () => {
  const verified = auth.authenticate({ role: "admin", accountId: "admin", password: "123456" }, 1000)
  auth.createSession(verified.account, { now: 1000 })
  const result = auth.readSession(1000 + auth.SESSION_DURATION_MS)
  assert.strictEqual(result.valid, false)
  assert.strictEqual(result.code, "SESSION_EXPIRED")
  assert.strictEqual(wx.getStorageSync("userInfo"), undefined)
})

test("角色守卫允许本角色并阻止越权访问", () => {
  const verified = auth.authenticate({ role: "student", accountId: "2024001", password: "123456" }, 1000)
  auth.createSession(verified.account, { now: Date.now() })
  assert.strictEqual(auth.requireRole("student").studentId, "2024001")
  assert.strictEqual(auth.requireRole("admin"), null)
  assert.strictEqual(calls.toast[0].title, "当前账号无权访问该页面")
  assert.strictEqual(calls.switchTab[0].url, "/pages/index/index")
})

test("三类角色分别进入自己的首页", () => {
  auth.routeToRoleHome({ role: "student" })
  auth.routeToRoleHome({ role: "counselor" })
  auth.routeToRoleHome({ role: "admin" })
  assert.strictEqual(calls.switchTab[0].url, "/pages/index/index")
  assert.deepStrictEqual(calls.reLaunch.map(item => item.url), ["/pages/counselor/dashboard", "/pages/admin/dashboard"])
})

console.log("\n认证模块测试全部通过")
