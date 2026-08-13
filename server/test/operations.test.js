const test = require("node:test")
const assert = require("node:assert/strict")
const { createRateLimiter } = require("../src/rate-limit")
const { createLogger, sanitize } = require("../src/logger")
const { createMetrics } = require("../src/metrics")

test("固定窗口限流返回剩余额度并在窗口后恢复", function() {
  let timestamp = 1000
  const limiter = createRateLimiter({ now:function() { return timestamp } })
  assert.equal(limiter.check("login:127.0.0.1", 2, 60000).allowed, true)
  assert.equal(limiter.check("login:127.0.0.1", 2, 60000).remaining, 0)
  const blocked = limiter.check("login:127.0.0.1", 2, 60000)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 60)
  timestamp += 60000
  assert.equal(limiter.check("login:127.0.0.1", 2, 60000).allowed, true)
})

test("结构化日志自动遮盖令牌、密码和心理答案", function() {
  const output = []
  const logger = createLogger("debug", function(line) { output.push(JSON.parse(line)) })
  logger.info("security_test", {
    accountId:"2024001",
    password:"unsafe",
    authorization:"Bearer token",
    nested:{ answerSnapshot:[1, 2], status:"ok" }
  })
  assert.equal(output[0].accountId, "2024001")
  assert.equal(output[0].password, "[REDACTED]")
  assert.equal(output[0].authorization, "[REDACTED]")
  assert.equal(output[0].nested.answerSnapshot, "[REDACTED]")
  assert.equal(sanitize({ token:"x" }, 0).token, "[REDACTED]")
})

test("Prometheus指标只使用有界路由标签", function() {
  const metrics = createMetrics()
  metrics.observe("GET", "/api/v1/counselor/students/:id/summary", 200, 0.025)
  const text = metrics.render()
  assert.match(text, /shuzhi_http_requests_total\{method="GET",route="\/api\/v1\/counselor\/students\/:id\/summary",status="200"\} 1/)
  assert.match(text, /shuzhi_process_resident_memory_bytes/)
})
