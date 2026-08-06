const assert = require("assert")

const storage = Object.create(null)
global.wx = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value }
}

const semester = require("../utils/semester")

function reset() {
  Object.keys(storage).forEach(key => delete storage[key])
  storage.semesters = [
    { id: "2026-1", name: "2026-2027学年第一学期", status: "当前学期", startDate: "2026-09-01", endDate: "2027-01-20" },
    { id: "2025-2", name: "2025-2026学年第二学期", status: "已归档", startDate: "2026-02-23", endDate: "2026-07-10" }
  ]
  storage.assessmentTasks = [{ id: 1, semesterId: "2026-1", title: "历史任务" }]
  storage.assessmentResults = [{ id: 2, semesterId: "2025-2", score: 20 }]
  storage.auditLogs = []
}

function test(name, callback) {
  try {
    reset()
    callback()
    console.log("✓", name)
  } catch (error) {
    console.error("✗", name)
    throw error
  }
}

test("从已有状态恢复唯一当前学期", function() {
  const current = semester.getCurrentSemester()
  assert.strictEqual(current.id, "2026-1")
  assert.strictEqual(storage.currentSemesterId, "2026-1")
})

test("创建学期会校验名称和日期", function() {
  assert.strictEqual(semester.createSemester({ name: "", startDate: "2027-01-01", endDate: "2027-02-01" }).ok, false)
  assert.strictEqual(semester.createSemester({ name: "不存在的日期", startDate: "2027-02-30", endDate: "2027-03-01" }).ok, false)
  assert.strictEqual(semester.createSemester({ name: "测试", startDate: "2027-03-01", endDate: "2027-02-01" }).ok, false)
  assert.strictEqual(semester.createSemester({ name: "2026-2027学年第一学期", startDate: "2027-03-01", endDate: "2027-07-01" }).ok, false)
})

test("新学期创建后默认为未开始并记录审计", function() {
  const result = semester.createSemester(
    { name: "2026-2027学年第二学期", startDate: "2027-02-22", endDate: "2027-07-09" },
    { id: "2026-2", now: new Date("2027-01-01T00:00:00.000Z") }
  )
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.semester.status, "未开始")
  assert.strictEqual(storage.semesterHistory.length, 1)
  assert.ok(storage.auditLogs[0].action.indexOf("创建学期") !== -1)
})

test("切换当前学期时保留历史任务和结果归属", function() {
  const tasksBefore = JSON.stringify(storage.assessmentTasks)
  const resultsBefore = JSON.stringify(storage.assessmentResults)
  semester.createSemester(
    { name: "2026-2027学年第二学期", startDate: "2027-02-22", endDate: "2027-07-09" },
    { id: "2026-2", now: new Date("2027-01-01T00:00:00.000Z") }
  )
  const result = semester.setCurrentSemester("2026-2", { now: new Date("2027-02-01T00:00:00.000Z") })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(semester.getCurrentSemester().id, "2026-2")
  assert.strictEqual(semester.getSemesters().find(item => item.id === "2026-1").status, "已归档")
  assert.strictEqual(JSON.stringify(storage.assessmentTasks), tasksBefore)
  assert.strictEqual(JSON.stringify(storage.assessmentResults), resultsBefore)
  assert.strictEqual(storage.semesterHistory[1].previousSemesterId, "2026-1")
})

test("历史学期快照可在切换后继续读取", function() {
  const snapshot = semester.getSemesterSnapshot("2025-2")
  assert.deepStrictEqual(snapshot, {
    id: "2025-2",
    name: "2025-2026学年第二学期",
    startDate: "2026-02-23",
    endDate: "2026-07-10"
  })
})

console.log("\n学期管理测试全部通过")
