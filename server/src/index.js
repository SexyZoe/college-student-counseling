const http = require("node:http")
const { loadConfig } = require("./config")
const { openDatabase, seedDemoData } = require("./database")
const { createServices } = require("./services")
const { createHttpApp } = require("./app")

const config = loadConfig()
const database = openDatabase(config.databasePath)
if (config.seedDemoData) {
  seedDemoData(database)
  console.warn("已启用虚构演示数据；禁止在正式学生数据环境中使用")
}
const services = createServices(database, config)
const server = http.createServer(createHttpApp(services, config))
server.requestTimeout = config.requestTimeoutMs
server.headersTimeout = config.headersTimeoutMs
server.keepAliveTimeout = config.keepAliveTimeoutMs

server.listen(config.port, config.host, function() {
  console.log("数智心港湾后端已启动：http://" + config.host + ":" + config.port)
  console.log("健康检查：http://" + config.host + ":" + config.port + "/health")
  console.log("就绪检查：http://" + config.host + ":" + config.port + "/ready")
})

let shuttingDown = false

function shutdown(signal, exitCode) {
  if (shuttingDown) return
  shuttingDown = true
  console.log("收到 " + signal + "，正在关闭服务")
  const forceTimer = setTimeout(function() {
    console.error("服务未在限定时间内关闭，强制退出")
    process.exit(1)
  }, config.shutdownTimeoutMs)
  forceTimer.unref()
  server.close(function() {
    clearTimeout(forceTimer)
    try { database.close() }
    catch (error) { console.error("关闭数据库失败", error) }
    process.exit(exitCode || 0)
  })
}

server.on("error", function(error) {
  console.error("HTTP 服务启动失败", error)
  shutdown("SERVER_ERROR", 1)
})

process.on("SIGINT", function() { shutdown("SIGINT", 0) })
process.on("SIGTERM", function() { shutdown("SIGTERM", 0) })
process.on("uncaughtException", function(error) {
  console.error("未捕获异常", error)
  shutdown("UNCAUGHT_EXCEPTION", 1)
})
process.on("unhandledRejection", function(error) {
  console.error("未处理 Promise 拒绝", error)
  shutdown("UNHANDLED_REJECTION", 1)
})
