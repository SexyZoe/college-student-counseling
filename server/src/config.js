const path = require("node:path")
const { decodeKey } = require("./data-protection")

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

function textSetting(env, name, fallback, allowed) {
  const value = String(env[name] || fallback)
  if (allowed.indexOf(value) === -1) throw new Error(name + " 必须是 " + allowed.join("、") + " 之一")
  return value
}

function loadConfig(environment) {
  const env = environment || process.env
  const nodeEnv = env.NODE_ENV || "development"
  const authSecret = env.AUTH_SECRET || DEVELOPMENT_SECRET
  const dataEncryptionKey = String(env.DATA_ENCRYPTION_KEY || "").trim()
  const metricsToken = String(env.METRICS_TOKEN || "").trim()
  if (nodeEnv === "production" && (!env.AUTH_SECRET || authSecret === DEVELOPMENT_SECRET || authSecret.length < 32)) {
    throw new Error("生产环境必须设置至少 32 个字符的 AUTH_SECRET")
  }
  if (nodeEnv === "production" && !dataEncryptionKey) {
    throw new Error("生产环境必须设置 DATA_ENCRYPTION_KEY 以加密心理敏感数据")
  }
  if (nodeEnv === "production" && metricsToken.length < 20) {
    throw new Error("生产环境必须设置至少20个字符的 METRICS_TOKEN")
  }
  if (dataEncryptionKey) decodeKey(dataEncryptionKey)
  const seedDemoData = booleanSetting(env, "SEED_DEMO_DATA", nodeEnv !== "production")
  if (nodeEnv === "production" && seedDemoData) {
    throw new Error("生产环境禁止启用 SEED_DEMO_DATA")
  }
  const databaseEngine = textSetting(env, "DATABASE_ENGINE", "sqlite", ["sqlite", "mysql"])
  const mysqlSslCa = String(env.MYSQL_SSL_CA || "").trim()
  if (databaseEngine === "mysql") {
    for (const name of ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"]) {
      if (!String(env[name] || "").trim()) throw new Error("使用 MySQL 时必须设置 " + name)
    }
  }
  if (nodeEnv === "production" && databaseEngine === "mysql" && !mysqlSslCa) {
    throw new Error("生产环境使用 MySQL 时必须设置 MYSQL_SSL_CA 并校验服务端证书")
  }
  return {
    nodeEnv: nodeEnv,
    host: env.HOST || "127.0.0.1",
    port: integerSetting(env, "PORT", 8787, 1, 65535),
    databasePath: env.DATABASE_PATH || path.join(__dirname, "..", "data", "app.db"),
    databaseEngine:databaseEngine,
    mysqlHost:String(env.MYSQL_HOST || "127.0.0.1").trim(),
    mysqlPort:integerSetting(env, "MYSQL_PORT", 3306, 1, 65535),
    mysqlDatabase:String(env.MYSQL_DATABASE || "").trim(),
    mysqlUser:String(env.MYSQL_USER || "").trim(),
    mysqlPassword:String(env.MYSQL_PASSWORD || ""),
    mysqlSslCa:mysqlSslCa,
    mysqlConnectionLimit:integerSetting(env, "MYSQL_CONNECTION_LIMIT", 20, 1, 200),
    mysqlIdleTimeoutMs:integerSetting(env, "MYSQL_IDLE_TIMEOUT_MS", 60000, 1000, 600000),
    mysqlQueueLimit:integerSetting(env, "MYSQL_QUEUE_LIMIT", 1000, 0, 10000),
    authSecret: authSecret,
    dataEncryptionKey: dataEncryptionKey,
    dataEncryptionKeyId: String(env.DATA_ENCRYPTION_KEY_ID || "primary").trim(),
    tokenTtlSeconds: integerSetting(env, "TOKEN_TTL_SECONDS", 8 * 60 * 60, 300, 24 * 60 * 60),
    maxBodyBytes: integerSetting(env, "MAX_BODY_BYTES", 1024 * 1024, 1024, 10 * 1024 * 1024),
    requestTimeoutMs: integerSetting(env, "REQUEST_TIMEOUT_MS", 30000, 1000, 120000),
    headersTimeoutMs: integerSetting(env, "HEADERS_TIMEOUT_MS", 10000, 1000, 60000),
    keepAliveTimeoutMs: integerSetting(env, "KEEP_ALIVE_TIMEOUT_MS", 5000, 1000, 60000),
    shutdownTimeoutMs: integerSetting(env, "SHUTDOWN_TIMEOUT_MS", 10000, 1000, 60000),
    generalRateLimitPerMinute: integerSetting(env, "GENERAL_RATE_LIMIT_PER_MINUTE", 300, 10, 10000),
    loginRateLimitPerMinute: integerSetting(env, "LOGIN_RATE_LIMIT_PER_MINUTE", 30, 5, 1000),
    trustProxy: booleanSetting(env, "TRUST_PROXY", false),
    logLevel: textSetting(env, "LOG_LEVEL", "info", ["debug", "info", "warn", "error"]),
    metricsToken: metricsToken,
    corsAllowedOrigins: originSetting(env, nodeEnv),
    seedDemoData: seedDemoData
  }
}

module.exports = { loadConfig, DEVELOPMENT_SECRET }
