const test = require("node:test")
const assert = require("node:assert/strict")
const storage = Object.create(null)
const routes = []
const modals = []
let pending
let definition
global.wx = {
  getStorageSync:key => storage[key],
  setStorageSync:(key, value) => { storage[key] = value },
  removeStorageSync:key => { delete storage[key] },
  request:options => { pending = options },
  showToast() {},
  showModal(options) { modals.push(options); if (options.success) options.success({ confirm:true }) },
  reLaunch:options => routes.push(options.url),
  switchTab:options => routes.push(options.url)
}
global.getApp = () => ({ globalData:{} })
global.Page = value => { definition = value }
global.setTimeout = callback => { callback(); return 1 }
require("../pages/login/login")

function page(role) {
  for (const key of Object.keys(storage)) delete storage[key]
  routes.length = 0
  modals.length = 0
  pending = null
  return Object.assign({}, definition, {
    data:Object.assign({}, definition.data, { role, accountId:"cloud-only-user", password:"cloud-password", agreed:true }),
    setData(value) { Object.assign(this.data, value) }
  })
}
function accept(role) {
  pending.success({ statusCode:200, data:{ ok:true, data:{ token:"remote-token", expiresIn:3600,
    user:{ role, accountId:"cloud-only-user", displayName:"云端用户", studentId:"cloud-only-user" }
  } } })
}

test("云端独有账号无需本地演示账号匹配；等待认证后才进入页面", async () => {
  const current = page("admin")
  const login = current.onLogin()
  assert.equal(storage.authSession, undefined)
  assert.deepEqual(routes, [])
  assert.equal(current.data.loading, true)
  accept("admin")
  await login
  assert.equal(storage.userInfo.accountId, "cloud-only-user")
  assert.equal(storage.backendSession.token, "remote-token")
  assert.equal(current.data.password, "")
  assert.deepEqual(routes, ["/pages/admin/dashboard"])
})
test("服务器拒绝密码时不得创建本地已登录状态", async () => {
  const current = page("admin")
  const login = current.onLogin()
  pending.success({ statusCode:401, data:{ error:{ code:"INVALID_CREDENTIALS", message:"账号或密码错误" } } })
  await login
  assert.equal(storage.authSession, undefined)
  assert.equal(storage.backendSession, undefined)
  assert.deepEqual(routes, [])
  assert.match(current.data.loginError, /密码/)
})
test("网络超时不得退回本地演示认证", async () => {
  const current = page("admin")
  current.data.accountId = "admin"
  current.data.password = "123456"
  const login = current.onLogin()
  pending.fail({ errMsg:"request:fail timeout" })
  await login
  assert.equal(storage.authSession, undefined)
  assert.deepEqual(routes, [])
  assert.match(current.data.loginError, /校园网/)
  assert.match(current.data.loginError, /timeout/)
})
test("学生跳过资料绑定复用已验证会话，不重复提交密码", async () => {
  const current = page("student")
  const login = current.onLogin()
  accept("student")
  await login
  assert.equal(current.data.step, "bind")
  assert.equal(storage.authSession, undefined)
  const firstRequest = pending
  current.onSkipBind()
  assert.equal(pending, firstRequest)
  assert.equal(storage.userInfo.studentName, "云端用户")
  assert.deepEqual(routes, ["/pages/index/index"])
})

test("格式不完整的云端会话不能创建本地登录状态", async () => {
  const current = page("admin")
  const login = current.onLogin()
  pending.success({ statusCode:200, data:{ ok:true, data:{ user:{ role:"admin", accountId:"cloud-only-user" } } } })
  await login
  assert.equal(storage.authSession, undefined)
  assert.equal(storage.backendSession, undefined)
  assert.deepEqual(routes, [])
  assert.match(current.data.loginError, /会话无效/)
})

test("返回角色与所选身份不符时清除令牌并拒绝跳转", async () => {
  const current = page("student")
  const login = current.onLogin()
  accept("admin")
  await login
  assert.equal(storage.backendSession, undefined)
  assert.deepEqual(routes, [])
  assert.match(current.data.loginError, /身份无效/)
})

test("新导入学生先进入资料与初始密码设置，不创建完整本地会话", async () => {
  const current = page("student")
  const login = current.onLogin()
  pending.success({ statusCode:200, data:{ ok:true, data:{ token:"limited-session", expiresIn:3600,
    user:{ role:"student", accountId:"cloud-only-user", profileCompleted:false, mustChangePassword:true }
  } } })
  await login
  assert.equal(storage.authSession, undefined)
  assert.equal(storage.backendSession.token, "limited-session")
  assert.equal(current.data.password, "")
  assert.deepEqual(routes, ["/pages/account/settings"])
  assert.match(modals[0].title, /修改初始密码/)
})

test("学生登录页说明人工找回密码流程", () => {
  const current = page("student")
  current.showPasswordRecovery()
  assert.equal(modals.length, 1)
  assert.match(modals[0].content, /辅导员/)
  assert.match(modals[0].content, /管理员/)
  assert.match(modals[0].content, /学号后4位/)
})
