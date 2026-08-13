const test = require("node:test")
const assert = require("node:assert/strict")
const { loadConfig } = require("../src/config")

test("开发环境提供安全可预测的默认配置", function() {
  const config = loadConfig({})
  assert.equal(config.port, 8787)
  assert.deepEqual(config.corsAllowedOrigins, ["*"])
  assert.equal(config.requestTimeoutMs, 30000)
  assert.equal(config.seedDemoData, true)
})

test("生产环境拒绝缺失或过短的令牌密钥", function() {
  assert.throws(function() { loadConfig({ NODE_ENV:"production" }) }, /AUTH_SECRET/)
  assert.throws(function() { loadConfig({ NODE_ENV:"production", AUTH_SECRET:"too-short" }) }, /32/)
})

test("生产环境接受长密钥并默认关闭跨域放行", function() {
  const config = loadConfig({ NODE_ENV:"production", AUTH_SECRET:"0123456789abcdef0123456789abcdef" })
  assert.deepEqual(config.corsAllowedOrigins, [])
  assert.equal(config.seedDemoData, false)
})

test("跨域白名单和数值配置能够被解析", function() {
  const config = loadConfig({
    CORS_ALLOWED_ORIGINS:"https://one.example, https://two.example",
    PORT:"9000",
    TOKEN_TTL_SECONDS:"3600"
  })
  assert.equal(config.port, 9000)
  assert.equal(config.tokenTtlSeconds, 3600)
  assert.deepEqual(config.corsAllowedOrigins, ["https://one.example", "https://two.example"])
})

test("非法端口和超时配置会在启动前失败", function() {
  assert.throws(function() { loadConfig({ PORT:"70000" }) }, /PORT/)
  assert.throws(function() { loadConfig({ REQUEST_TIMEOUT_MS:"abc" }) }, /REQUEST_TIMEOUT_MS/)
  assert.throws(function() { loadConfig({ SEED_DEMO_DATA:"sometimes" }) }, /SEED_DEMO_DATA/)
})
