const assert = require("node:assert/strict")

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "")

async function request(path, options) {
  const response = await fetch(baseUrl + path, options)
  const text = await response.text()
  return { status:response.status, body:text ? JSON.parse(text) : null }
}

async function login(role, accountId) {
  return request("/api/v1/auth/login", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ role:role, accountId:accountId, password:"123456" })
  })
}

async function main() {
  const health = await request("/health")
  assert.equal(health.status, 200)
  assert.equal(health.body.data.status, "ok")

  const ready = await request("/ready")
  assert.equal(ready.status, 200)
  assert.equal(ready.body.data.database, "ok")

  const anonymous = await request("/api/v1/assessment-tasks")
  assert.equal(anonymous.status, 401)
  assert.equal(anonymous.body.error.code, "AUTH_REQUIRED")

  const wrongPassword = await request("/api/v1/auth/login", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ role:"student", accountId:"2024001", password:"wrong-password" })
  })
  assert.equal(wrongPassword.status, 401)
  assert.equal(wrongPassword.body.error.code, "INVALID_CREDENTIALS")

  const accounts = [
    ["student", "2024001"],
    ["counselor", "T001"],
    ["admin", "admin"]
  ]
  for (const account of accounts) {
    const response = await login(account[0], account[1])
    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.role, account[0])
    assert.ok(String(response.body.data.token || "").length > 20)
  }

  console.log("Docker 冒烟测试通过：健康、就绪、匿名拒绝、错误密码和三类角色登录均正常")
}

main().catch(function(error) {
  console.error("Docker 冒烟测试失败：" + error.message)
  process.exit(1)
})
