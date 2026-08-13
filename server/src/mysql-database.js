const { AsyncLocalStorage } = require("node:async_hooks")
const fs = require("node:fs")
const mysql = require("mysql2/promise")

function mysqlPoolOptions(config) {
  const options = {
    host:config.mysqlHost,
    port:config.mysqlPort,
    user:config.mysqlUser,
    password:config.mysqlPassword,
    database:config.mysqlDatabase,
    charset:"utf8mb4",
    timezone:"Z",
    dateStrings:true,
    waitForConnections:true,
    connectionLimit:config.mysqlConnectionLimit,
    maxIdle:config.mysqlConnectionLimit,
    idleTimeout:config.mysqlIdleTimeoutMs,
    queueLimit:config.mysqlQueueLimit,
    enableKeepAlive:true,
    keepAliveInitialDelay:0
  }
  if (config.mysqlSslCa) {
    options.ssl = {
      ca:fs.readFileSync(config.mysqlSslCa, "utf8"),
      rejectUnauthorized:true
    }
  }
  return options
}

function mysqlSql(sql) {
  return String(sql)
    .replace(/INSERT\s+OR\s+IGNORE/gi, "INSERT IGNORE")
    .replace(
      /ON\s+CONFLICT\s*\(attempt_key\)\s+DO\s+UPDATE\s+SET\s+failure_count\s*=\s*excluded\.failure_count,\s*locked_until\s*=\s*excluded\.locked_until,\s*updated_at\s*=\s*excluded\.updated_at/gi,
      "ON DUPLICATE KEY UPDATE failure_count = VALUES(failure_count), locked_until = VALUES(locked_until), updated_at = VALUES(updated_at)"
    )
    .replace(
      /ON\s+CONFLICT\s*\(counselor_user_id,\s*class_id,\s*semester_id\)\s+DO\s+UPDATE\s+SET\s+active\s*=\s*1/gi,
      "ON DUPLICATE KEY UPDATE active = 1"
    )
}

function mysqlParameter(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 23).replace("T", " ")
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return value.slice(0, 23).replace("T", " ").replace("Z", "")
  }
  return value
}

function normalizeMysqlValue(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value)) {
    const parts = value.split(".")
    const milliseconds = (parts[1] || "").padEnd(3, "0")
    return parts[0].replace(" ", "T") + "." + milliseconds + "Z"
  }
  return value
}

function normalizeMysqlRow(row) {
  if (!row || typeof row !== "object") return row
  const normalized = {}
  for (const key of Object.keys(row)) normalized[key] = normalizeMysqlValue(row[key])
  return normalized
}

function createMysqlDatabase(config) {
  const pool = mysql.createPool(mysqlPoolOptions(config))
  const transactionStorage = new AsyncLocalStorage()

  function connection() {
    return transactionStorage.getStore() || pool
  }

  function prepare(sql) {
    const statement = mysqlSql(sql)
    return {
      async get() {
        const parameters = Array.from(arguments).map(mysqlParameter)
        const [rows] = await connection().execute(statement, parameters)
        return normalizeMysqlRow(rows[0])
      },
      async all() {
        const parameters = Array.from(arguments).map(mysqlParameter)
        const [rows] = await connection().execute(statement, parameters)
        return rows.map(normalizeMysqlRow)
      },
      async run() {
        const parameters = Array.from(arguments).map(mysqlParameter)
        const [result] = await connection().execute(statement, parameters)
        return {
          changes:result.affectedRows,
          lastInsertRowid:result.insertId
        }
      }
    }
  }

  async function transaction(callback) {
    const active = transactionStorage.getStore()
    if (active) return callback()
    const client = await pool.getConnection()
    try {
      await client.beginTransaction()
      const result = await transactionStorage.run(client, callback)
      await client.commit()
      return result
    } catch (error) {
      await client.rollback()
      throw error
    } finally {
      client.release()
    }
  }

  return {
    dialect:"mysql",
    prepare:prepare,
    transaction:transaction,
    async ping() {
      const [rows] = await pool.query("SELECT 1 AS ready")
      return normalizeMysqlRow(rows[0])
    },
    async close() { await pool.end() }
  }
}

module.exports = { createMysqlDatabase, mysqlPoolOptions, mysqlSql, mysqlParameter, normalizeMysqlValue }
