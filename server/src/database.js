const fs = require("node:fs")
const path = require("node:path")
const { DatabaseSync } = require("node:sqlite")
const { createPasswordRecord, normalizeAccountId } = require("./security")

function openDatabase(filename) {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true })
  const database = new DatabaseSync(filename)
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8")
  database.exec(schema)
  return database
}

function inTransaction(database, callback) {
  database.exec("BEGIN IMMEDIATE")
  try {
    const result = callback()
    database.exec("COMMIT")
    return result
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

function seedUser(database, user) {
  const record = createPasswordRecord(user.password, "demo-salt-" + user.id)
  database.prepare(`
    INSERT OR IGNORE INTO users
      (id, role, account_id, password_hash, password_salt, display_name, student_no, staff_no, class_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id, user.role, normalizeAccountId(user.accountId), record.hash, record.salt,
    user.displayName, user.studentNo || null, user.staffNo || null, user.classId || null, "2026-08-06T00:00:00.000Z"
  )
}

function seedDemoData(database) {
  inTransaction(database, function() {
    database.prepare("INSERT OR IGNORE INTO semesters (id, name, start_date, end_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("2026-1", "2026-2027学年第一学期", "2026-09-01", "2027-01-20", "当前学期", "2026-08-01T01:00:00.000Z")
    database.prepare("INSERT OR IGNORE INTO semesters (id, name, start_date, end_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("2025-2", "2025-2026学年第二学期", "2026-02-23", "2026-07-10", "已归档", "2026-02-01T01:00:00.000Z")

    const insertClass = database.prepare("INSERT OR IGNORE INTO classes (id, name, major) VALUES (?, ?, ?)")
    insertClass.run("CS2401", "计科2401", "计算机科学与技术")
    insertClass.run("AI2401", "人工智能2401", "人工智能")

    seedUser(database, { id: "student-2024001", role: "student", accountId: "2024001", password: "123456", displayName: "张同学", studentNo: "2024001", classId: "CS2401" })
    seedUser(database, { id: "student-2024002", role: "student", accountId: "2024002", password: "123456", displayName: "李同学", studentNo: "2024002", classId: "CS2401" })
    seedUser(database, { id: "counselor-t001", role: "counselor", accountId: "T001", password: "123456", displayName: "王辅导员", staffNo: "T001" })
    seedUser(database, { id: "admin-a001", role: "admin", accountId: "admin", password: "123456", displayName: "系统管理员", staffNo: "A001" })

    const assignment = database.prepare("INSERT OR IGNORE INTO counselor_class_assignments (counselor_user_id, class_id, semester_id, created_at) VALUES (?, ?, ?, ?)")
    assignment.run("counselor-t001", "CS2401", "2026-1", "2026-08-01T01:00:00.000Z")
    assignment.run("counselor-t001", "AI2401", "2026-1", "2026-08-01T01:00:00.000Z")

    const insertTask = database.prepare(`
      INSERT OR IGNORE INTO assessment_tasks
        (id, assessment_id, title, semester_id, questionnaire_version, scoring_version, deadline, status, target_class_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertTask.run("101", 1, "秋季学期心理状态普测", "2026-1", "1.0.0", "2.0.0", "2026-09-30", "进行中", "CS2401", "2026-08-01T01:00:00.000Z")
    insertTask.run("102", 3, "期中学业压力自评", "2026-1", "1.0.0", "2.0.0", "2026-11-15", "未开始", "CS2401", "2026-08-01T01:00:00.000Z")
    insertTask.run("103", 7, "睡眠健康自查", "2026-1", "1.0.0", "2.0.0", "2026-10-20", "进行中", "CS2401", "2026-08-01T01:00:00.000Z")
  })
}

module.exports = { openDatabase, inTransaction, seedDemoData }
