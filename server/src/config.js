const path = require("node:path")

function loadConfig(environment) {
  const env = environment || process.env
  const nodeEnv = env.NODE_ENV || "development"
  const authSecret = env.AUTH_SECRET || "local-development-secret-change-before-deploy"
  if (nodeEnv === "production" && !env.AUTH_SECRET) {
    throw new Error("生产环境必须设置 AUTH_SECRET")
  }
  return {
    nodeEnv: nodeEnv,
    host: env.HOST || "127.0.0.1",
    port: parseInt(env.PORT || "8787", 10),
    databasePath: env.DATABASE_PATH || path.join(__dirname, "..", "data", "app.db"),
    authSecret: authSecret,
    tokenTtlSeconds: parseInt(env.TOKEN_TTL_SECONDS || String(8 * 60 * 60), 10),
    maxBodyBytes: parseInt(env.MAX_BODY_BYTES || String(1024 * 1024), 10)
  }
}

module.exports = { loadConfig }
