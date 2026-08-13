const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const mysql = require("mysql2/promise")

const MIGRATIONS_DIRECTORY = path.join(__dirname, "..", "src", "migrations", "mysql")
const LOCK_NAME = "shuzhi-heart-harbor-schema-migrations"

function required(name) {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error("缺少环境变量 " + name)
  return value
}

function connectionOptions() {
  const sslCaPath = String(process.env.MYSQL_SSL_CA || "").trim()
  const options = {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: required("MYSQL_USER"),
    password: required("MYSQL_PASSWORD"),
    database: required("MYSQL_DATABASE"),
    charset: "utf8mb4",
    timezone: "Z",
    multipleStatements: true
  }
  if (sslCaPath) {
    options.ssl = { ca:fs.readFileSync(sslCaPath, "utf8"), rejectUnauthorized:true }
  }
  return options
}

function checksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex")
}

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIRECTORY)
    .filter(function(name) { return /^\d{3}_[a-z0-9_-]+\.sql$/i.test(name) })
    .sort()
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(16) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)
}

async function migrate(connection, statusOnly) {
  await ensureMigrationTable(connection)
  const [lockRows] = await connection.query("SELECT GET_LOCK(?, 30) AS acquired", [LOCK_NAME])
  if (!lockRows[0] || Number(lockRows[0].acquired) !== 1) throw new Error("未能取得数据库迁移锁")
  try {
    const [rows] = await connection.query("SELECT version, checksum FROM schema_migrations")
    const applied = new Map(rows.map(function(row) { return [String(row.version), row.checksum] }))
    const files = migrationFiles()
    const pending = []
    for (const fileName of files) {
      const version = fileName.slice(0, 3)
      const content = fs.readFileSync(path.join(MIGRATIONS_DIRECTORY, fileName), "utf8")
      const digest = checksum(content)
      if (applied.has(version)) {
        if (applied.get(version) !== digest) throw new Error("数据库迁移 " + fileName + " 已被修改")
        continue
      }
      pending.push({ version:version, fileName:fileName, content:content, checksum:digest })
    }
    if (statusOnly) {
      console.log(JSON.stringify({ applied:applied.size, pending:pending.map(function(item) { return item.fileName }) }))
      return
    }
    for (const item of pending) {
      await connection.beginTransaction()
      try {
        await connection.query(item.content)
        await connection.query(
          "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))",
          [item.version, item.fileName, item.checksum]
        )
        await connection.commit()
        console.log("已执行 MySQL 迁移：" + item.fileName)
      } catch (error) {
        await connection.rollback()
        throw error
      }
    }
    if (!pending.length) console.log("MySQL 数据库结构已是最新版本")
  } finally {
    await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME])
  }
}

async function main() {
  const connection = await mysql.createConnection(connectionOptions())
  try { await migrate(connection, process.argv.indexOf("--status") !== -1) }
  finally { await connection.end() }
}

main().catch(function(error) {
  console.error("MySQL 迁移失败：" + error.message)
  process.exit(1)
})
