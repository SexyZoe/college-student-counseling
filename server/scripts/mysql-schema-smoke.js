const assert = require("node:assert/strict")
const fs = require("node:fs")
const mysql = require("mysql2/promise")

function required(name) {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error("缺少环境变量 " + name)
  return value
}

function options() {
  const sslCaPath = String(process.env.MYSQL_SSL_CA || "").trim()
  const value = {
    host:process.env.MYSQL_HOST || "127.0.0.1",
    port:Number(process.env.MYSQL_PORT || 3306),
    user:required("MYSQL_USER"),
    password:required("MYSQL_PASSWORD"),
    database:required("MYSQL_DATABASE"),
    charset:"utf8mb4",
    timezone:"Z"
  }
  if (sslCaPath) value.ssl = { ca:fs.readFileSync(sslCaPath, "utf8"), rejectUnauthorized:true }
  return value
}

async function main() {
  const connection = await mysql.createConnection(options())
  const firstId = "__schema-smoke-current-a"
  const secondId = "__schema-smoke-current-b"
  try {
    const [migrationRows] = await connection.query("SELECT version, checksum FROM schema_migrations ORDER BY version")
    assert.equal(migrationRows.length >= 1, true)
    assert.match(migrationRows[0].checksum, /^[a-f0-9]{64}$/)

    const [tableRows] = await connection.query(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?",
      [required("MYSQL_DATABASE")]
    )
    assert.equal(Number(tableRows[0].count) >= 12, true)

    await connection.query("DELETE FROM semesters WHERE id IN (?, ?)", [firstId, secondId])
    await connection.query(
      "INSERT INTO semesters (id, name, start_date, end_date, status, created_at) VALUES (?, ?, '2038-01-01', '2038-06-30', '当前学期', UTC_TIMESTAMP(3))",
      [firstId, "结构验收学期A"]
    )
    let rejectedSecondCurrent = false
    try {
      await connection.query(
        "INSERT INTO semesters (id, name, start_date, end_date, status, created_at) VALUES (?, ?, '2038-07-01', '2038-12-31', '当前学期', UTC_TIMESTAMP(3))",
        [secondId, "结构验收学期B"]
      )
    } catch (error) {
      rejectedSecondCurrent = error && error.code === "ER_DUP_ENTRY"
    }
    assert.equal(rejectedSecondCurrent, true)
    console.log("MySQL结构验收通过：迁移记录、业务表和唯一当前学期约束均正常")
  } finally {
    await connection.query("DELETE FROM semesters WHERE id IN (?, ?)", [firstId, secondId])
    await connection.end()
  }
}

main().catch(function(error) {
  console.error("MySQL结构验收失败：" + error.message)
  process.exit(1)
})
