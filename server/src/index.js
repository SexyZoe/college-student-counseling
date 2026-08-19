const http = require("node:http")
const { loadConfig } = require("./config")
const { openConfiguredDatabase, seedDemoData } = require("./database")
const { createServices } = require("./services")
const { createHttpApp } = require("./app")
const { createLogger } = require("./logger")

const config = loadConfig()
const logger = createLogger(config.logLevel)
let database
let server

let shuttingDown = false

async function shutdown(signal, exitCode) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info("server_shutdown_started", { signal:signal })
  const forceTimer = setTimeout(function() {
    logger.error("server_shutdown_timeout", { signal:signal })
    process.exit(1)
  }, config.shutdownTimeoutMs)
  forceTimer.unref()
  if (!server) return process.exit(exitCode || 0)
  server.close(async function() {
    clearTimeout(forceTimer)
    try { await database.close() }
    catch (error) { logger.error("database_close_failed", { errorMessage:error.message }) }
    process.exit(exitCode || 0)
  })
}

async function main() {
  database = await openConfiguredDatabase(config)
  if (config.seedDemoData) {
    await seedDemoData(database)
    logger.warn("demo_data_enabled", { message:"已启用虚构演示数据；禁止在正式学生数据环境中使用" })
  }
  const services = createServices(database, config)
  server = http.createServer(createHttpApp(services, config, { logger:logger }))
  server.requestTimeout = config.requestTimeoutMs
  server.headersTimeout = config.headersTimeoutMs
  server.keepAliveTimeout = config.keepAliveTimeoutMs
  server.on("error", function(error) {
    logger.error("http_server_failed", { errorName:error.name, errorMessage:error.message })
    shutdown("SERVER_ERROR", 1)
  })
  server.listen(config.port, config.host, function() {
    logger.info("server_started", { host:config.host, port:config.port, nodeEnv:config.nodeEnv, databaseEngine:config.databaseEngine })
  })
}

process.on("SIGINT", function() { shutdown("SIGINT", 0) })
process.on("SIGTERM", function() { shutdown("SIGTERM", 0) })
process.on("uncaughtException", function(error) {
  logger.error("uncaught_exception", { errorName:error.name, errorMessage:error.message })
  shutdown("UNCAUGHT_EXCEPTION", 1)
})
process.on("unhandledRejection", function(error) {
  logger.error("unhandled_rejection", { errorName:error && error.name, errorMessage:error && error.message })
  shutdown("UNHANDLED_REJECTION", 1)
})

main().catch(function(error) {
  logger.error("server_start_failed", { errorName:error.name, errorMessage:error.message })
  process.exit(1)
})
