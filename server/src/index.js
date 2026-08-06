const http = require("node:http")
const { loadConfig } = require("./config")
const { openDatabase, seedDemoData } = require("./database")
const { createServices } = require("./services")
const { createHttpApp } = require("./app")

const config = loadConfig()
const database = openDatabase(config.databasePath)
seedDemoData(database)
const services = createServices(database, config)
const server = http.createServer(createHttpApp(services, config))

server.listen(config.port, config.host, function() {
  console.log("数智心港湾后端已启动：http://" + config.host + ":" + config.port)
  console.log("健康检查：http://" + config.host + ":" + config.port + "/health")
})

function shutdown(signal) {
  console.log("收到 " + signal + "，正在关闭服务")
  server.close(function() {
    database.close()
    process.exit(0)
  })
}

process.on("SIGINT", function() { shutdown("SIGINT") })
process.on("SIGTERM", function() { shutdown("SIGTERM") })
