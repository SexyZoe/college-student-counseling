const path = require("node:path")

const DEVELOPMENT_SECRET = "local-development-secret-change-before-deploy"

function integerSetting(env, name, fallback, min, max) {
  const raw = env[name]
  const value = raw === undefined || raw === "" ? fallback : Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(name + " 必须是 " + min + " 到 " + max + " 之间的整数")
  }
  return value
}

function originSetting(env, nodeEnv) {
  if (!env.CORS_ALLOWED_ORIGINS) return nodeEnv === "production" ? [] : ["*"]
  return String(env.CORS_ALLOWED_ORIGINS).split(",").map(function(origin) {
    return origin.trim()
  }).filter(Boolean)
}

function booleanSetting(env, name, fallback) {
  if (env[name] === undefined || env[name] === "") return fallback
  if (env[name] === true || env[name] === "true" || env[name] === "1") return true
  if (env[name] === false || env[name] === "false" || env[name] === "0") return false
  throw new Error(name + " 必须是 true、false、1 或 0")
}

function loadConfig(environment) {
  const env = environment || process.env
  const nodeEnv = env.NODE_ENV || "development"
  const authSecret = env.AUTH_SECRET || DEVELOPMENT_SECRET
  if (nodeEnv === "production" && (!env.AUTH_SECRET || authSecret === DEVELOPMENT_SECRET || authSecret.length < 32)) {
    throw new Error("生产环境必须设置至少 32 个字符的 AUTH_SECRET")
  }
  return {
    nodeEnv: nodeEnv,
    host: env.HOST || "127.0.0.1",
    port: integerSetting(env, "PORT", 8787, 1, 65535),
    databasePath: env.DATABASE_PATH || path.join(__dirname, "..", "data", "app.db"),
    authSecret: authSecret,
    tokenTtlSeconds: integerSetting(env, "TOKEN_TTL_SECONDS", 8 * 60 * 60, 300, 24 * 60 * 60),
    maxBodyBytes: integerSetting(env, "MAX_BODY_BYTES", 1024 * 1024, 1024, 10 * 1024 * 1024),
    requestTimeoutMs: integerSetting(env, "REQUEST_TIMEOUT_MS", 30000, 1000, 120000),
    headersTimeoutMs: integerSetting(env, "HEADERS_TIMEOUT_MS", 10000, 1000, 60000),
    keepAliveTimeoutMs: integerSetting(env, "KEEP_ALIVE_TIMEOUT_MS", 5000, 1000, 60000),
    shutdownTimeoutMs: integerSetting(env, "SHUTDOWN_TIMEOUT_MS", 10000, 1000, 60000),
    corsAllowedOrigins: originSetting(env, nodeEnv),
    seedDemoData: booleanSetting(env, "SEED_DEMO_DATA", nodeEnv !== "production")
  }
}

module.exports = { loadConfig, DEVELOPMENT_SECRET }
