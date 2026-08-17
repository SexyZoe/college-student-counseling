const assert = require("assert")

const storage = Object.create(null)
const calls = { toast: [], reLaunch: [], switchTab: [], navigateTo: [] }

global.wx = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] },
  showToast(options) { calls.toast.push(options) },
  reLaunch(options) { calls.reLaunch.push(options) },
  switchTab(options) { calls.switchTab.push(options) },
  navigateTo(options) { calls.navigateTo.push(options) },
  getUserProfile() {}
}

const app = { globalData: {} }
global.getApp = () => app
global.setTimeout = callback => { callback(); return 1 }

let pageDefinition
global.Page = definition => { pageDefinition = definition }
require("../pages/login/login")

function createPage() {
  return Object.assign({}, pageDefinition, {
    data: JSON.parse(JSON.stringify(pageDefinition.data)),
    setData(changes) { Object.assign(this.data, changes) }
  })
}

function reset() {
  Object.keys(storage).forEach(key => delete storage[key])
  Object.keys(calls).forEach(key => { calls[key].length = 0 })
  app.globalData = {}
}

function test(name, callback) {
  reset()
  callback()
  console.log("✓", name)
}

test("原生输入事件能够正确写入账号和密码", () => {
  const page = createPage()
  page.onAccountInput({ detail: { value: "2024001" } })
  page.onPasswordInput({ detail: { value: "123456" } })
  assert.strictEqual(page.data.accountId, "2024001")
  assert.strictEqual(page.data.password, "123456")
})

test("切换角色会同步字段提示并清空旧凭据", () => {
  const page = createPage()
  page.setData({ accountId: "2024001", password: "123456" })
  page.onRoleTap({ currentTarget: { dataset: { role: "counselor" } } })
  assert.strictEqual(page.data.role, "counselor")
  assert.strictEqual(page.data.accountLabel, "工号")
  assert.strictEqual(page.data.accountId, "")
  assert.strictEqual(page.data.password, "")
})

test("未同意隐私政策时不提交登录", () => {
  const page = createPage()
  page.setData({ accountId: "T001", password: "123456", role: "counselor" })
  page.onLogin()
  assert.ok(page.data.loginError.includes("隐私政策"))
  assert.strictEqual(storage.userInfo, undefined)
})

test("辅导员登录后创建会话并进入辅导员工作台", () => {
  const page = createPage()
  page.setData({ role: "counselor", accountId: "T001", password: "123456", agreed: true })
  page.onLogin()
  assert.strictEqual(storage.userInfo.role, "counselor")
  assert.strictEqual(storage.authSession.role, "counselor")
  assert.strictEqual(calls.reLaunch[0].url, "/pages/counselor/dashboard")
})

test("学生验证后完成可跳过的微信绑定并进入学生首页", () => {
  const page = createPage()
  page.setData({ role: "student", accountId: "2024001", password: "123456", agreed: true })
  page.onLogin()
  assert.strictEqual(page.data.step, "bind")
  assert.strictEqual(storage.userInfo, undefined)
  page.onSkipBind()
  assert.strictEqual(storage.userInfo.role, "student")
  assert.strictEqual(storage.userInfo.wechatBound, false)
  assert.strictEqual(calls.switchTab[0].url, "/pages/index/index")
})

test("学生填写微信昵称后可完成绑定", () => {
  const page = createPage()
  page.setData({ role: "student", accountId: "2024001", password: "123456", agreed: true })
  page.onLogin()
  page.onNickNameInput({ detail: { value: "微信昵称" } })
  page.confirmWechatBind()
  assert.strictEqual(storage.userInfo.wechatBound, true)
  assert.strictEqual(storage.userInfo.nickName, "微信昵称")
  assert.strictEqual(calls.switchTab[0].url, "/pages/index/index")
})

console.log("\n登录页面测试全部通过")
