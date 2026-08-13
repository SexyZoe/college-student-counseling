const test = require("node:test")
const assert = require("node:assert/strict")
const { mysqlSql, mysqlParameter, normalizeMysqlValue } = require("../src/mysql-database")

test("MySQL适配层转换SQLite幂等写法但保留参数化查询", function() {
  assert.match(mysqlSql("INSERT OR IGNORE INTO users (id) VALUES (?)"), /^INSERT IGNORE/)
  assert.match(mysqlSql(`
    INSERT INTO auth_login_attempts (attempt_key, failure_count, locked_until, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(attempt_key) DO UPDATE SET
      failure_count = excluded.failure_count,
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  `), /ON DUPLICATE KEY UPDATE/)
  assert.equal(mysqlSql("SELECT * FROM users WHERE id = ?"), "SELECT * FROM users WHERE id = ?")
})

test("MySQL适配层统一UTC时间输入输出", function() {
  assert.equal(mysqlParameter("2026-08-14T01:02:03.456Z"), "2026-08-14 01:02:03.456")
  assert.equal(normalizeMysqlValue("2026-08-14 01:02:03.456"), "2026-08-14T01:02:03.456Z")
  assert.equal(normalizeMysqlValue("2026-08-14"), "2026-08-14")
})
