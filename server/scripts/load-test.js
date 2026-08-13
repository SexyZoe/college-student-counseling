const { performance } = require("node:perf_hooks")

function integer(name, fallback, min, max) {
  const value = process.env[name] ? Number(process.env[name]) : fallback
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(name + " 必须是 " + min + " 到 " + max + " 的整数")
  return value
}

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "")
const profile = String(process.env.LOAD_PROFILE || "health")
const total = integer("TOTAL_REQUESTS", 2000, 1, 100000)
const concurrency = integer("CONCURRENCY", 100, 1, 2000)
const timeoutMs = integer("REQUEST_TIMEOUT_MS", 5000, 100, 60000)
const maxP95Ms = integer("MAX_P95_MS", profile === "login" ? 2000 : 500, 1, 60000)
const maxErrorRate = Number(process.env.MAX_ERROR_RATE || 0.01)

if (["health", "login"].indexOf(profile) === -1) throw new Error("LOAD_PROFILE 只支持 health 或 login")
if (!Number.isFinite(maxErrorRate) || maxErrorRate < 0 || maxErrorRate > 1) throw new Error("MAX_ERROR_RATE 必须在0到1之间")

function requestOptions(index) {
  if (profile === "health") return { path:"/ready", options:{} }
  const accountId = index % 2 === 0 ? "2024001" : "2024002"
  return {
    path:"/api/v1/auth/login",
    options:{
      method:"POST",
      headers:{ "content-type":"application/json" },
      body:JSON.stringify({ role:"student", accountId:accountId, password:"123456" })
    }
  }
}

async function execute(index) {
  const request = requestOptions(index)
  const started = performance.now()
  try {
    const response = await fetch(baseUrl + request.path, Object.assign({}, request.options, { signal:AbortSignal.timeout(timeoutMs) }))
    await response.arrayBuffer()
    return { ok:response.ok, status:response.status, durationMs:performance.now() - started }
  } catch (error) {
    return { ok:false, status:0, durationMs:performance.now() - started, error:error.name }
  }
}

function percentile(sorted, value) {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)]
}

async function main() {
  let cursor = 0
  const results = []
  const started = performance.now()
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= total) return
      results.push(await execute(index))
    }
  }
  await Promise.all(Array.from({ length:Math.min(concurrency, total) }, worker))
  const elapsedSeconds = (performance.now() - started) / 1000
  const durations = results.map(function(item) { return item.durationMs }).sort(function(a, b) { return a - b })
  const failures = results.filter(function(item) { return !item.ok })
  const statuses = {}
  results.forEach(function(item) { statuses[item.status] = (statuses[item.status] || 0) + 1 })
  const summary = {
    profile:profile,
    target:baseUrl,
    total:results.length,
    concurrency:concurrency,
    elapsedSeconds:Number(elapsedSeconds.toFixed(3)),
    requestsPerSecond:Number((results.length / elapsedSeconds).toFixed(2)),
    errorRate:Number((failures.length / results.length).toFixed(4)),
    latencyMs:{
      min:Number((durations[0] || 0).toFixed(2)),
      p50:Number(percentile(durations, 0.5).toFixed(2)),
      p95:Number(percentile(durations, 0.95).toFixed(2)),
      p99:Number(percentile(durations, 0.99).toFixed(2)),
      max:Number((durations[durations.length - 1] || 0).toFixed(2))
    },
    statuses:statuses,
    thresholds:{ maxP95Ms:maxP95Ms, maxErrorRate:maxErrorRate }
  }
  console.log(JSON.stringify(summary, null, 2))
  if (summary.errorRate > maxErrorRate || summary.latencyMs.p95 > maxP95Ms) process.exitCode = 1
}

main().catch(function(error) {
  console.error("压力测试失败：" + error.message)
  process.exit(1)
})
