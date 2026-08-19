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
  assert.throws(function() {
    loadConfig({ NODE_ENV:"production", AUTH_SECRET:"0123456789abcdef0123456789abcdef" })
  }, /DATA_ENCRYPTION_KEY/)
  const config = loadConfig({
    NODE_ENV:"production",
    AUTH_SECRET:"0123456789abcdef0123456789abcdef",
    DATA_ENCRYPTION_KEY:"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    METRICS_TOKEN:"production-metrics-token"
  })
  assert.deepEqual(config.corsAllowedOrigins, [])
  assert.equal(config.seedDemoData, false)
  assert.throws(function() {
    loadConfig({
      NODE_ENV:"production",
      AUTH_SECRET:"0123456789abcdef0123456789abcdef",
      DATA_ENCRYPTION_KEY:"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      METRICS_TOKEN:"production-metrics-token",
      SEED_DEMO_DATA:"true"
    })
  }, /禁止启用/)
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
  assert.throws(function() { loadConfig({ DATA_ENCRYPTION_KEY:"too-short" }) }, /32字节/)
})

test("MySQL运行时要求完整连接配置且生产环境强制TLS", function() {
  assert.throws(function() { loadConfig({ DATABASE_ENGINE:"mysql" }) }, /MYSQL_HOST/)
  const testConfig = loadConfig({
    NODE_ENV:"test",
    DATABASE_ENGINE:"mysql",
    MYSQL_HOST:"mysql",
    MYSQL_DATABASE:"shuzhi",
    MYSQL_USER:"app",
    MYSQL_PASSWORD:"test-password",
    MYSQL_CONNECTION_LIMIT:"24"
  })
  assert.equal(testConfig.databaseEngine, "mysql")
  assert.equal(testConfig.mysqlConnectionLimit, 24)
  assert.throws(function() {
    loadConfig({
      NODE_ENV:"production",
      DATABASE_ENGINE:"mysql",
      MYSQL_HOST:"mysql",
      MYSQL_DATABASE:"shuzhi",
      MYSQL_USER:"app",
      MYSQL_PASSWORD:"production-password",
      AUTH_SECRET:"0123456789abcdef0123456789abcdef",
      DATA_ENCRYPTION_KEY:"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      METRICS_TOKEN:"production-metrics-token"
    })
  }, /MYSQL_SSL_CA/)
})
