const assert = require("assert")
const scoring = require("../utils/scoring-engine")

function question(id, scores) {
  return {
    id: id,
    title: "题目" + id,
    options: scores.map(function(score, index) {
      return { label: String(index), text: "选项" + index, score: score }
    })
  }
}

function test(name, callback) {
  try {
    callback()
    console.log("✓", name)
  } catch (error) {
    console.error("✗", name)
    throw error
  }
}

test("正向题按规则反向计分", function() {
  const outcome = scoring.scoreAssessment({
    assessmentId: 1,
    questions: [question(1, [1, 2, 3, 4]), question(5, [4, 3, 2, 1])],
    answers: { 0: 3, 1: 0 },
    rule: scoring.getRule(1)
  })
  assert.strictEqual(outcome.rawScore, 5)
  assert.strictEqual(outcome.responseDetails[1].originalScore, 4)
  assert.strictEqual(outcome.responseDetails[1].scoredValue, 1)
  assert.strictEqual(outcome.responseDetails[1].reversed, true)
})

test("健康保护型量表标准化后转换为风险分", function() {
  const outcome = scoring.scoreAssessment({
    assessmentId: 8,
    questions: [question(1, [1, 2, 3, 4]), question(2, [1, 2, 3, 4])],
    answers: { 0: 3, 1: 3 },
    rule: scoring.getRule(8)
  })
  assert.strictEqual(outcome.normalizedRiskScore, 0)
  assert.strictEqual(outcome.wellbeingIndex, 100)
  assert.strictEqual(outcome.riskLevel, "正常")
})

test("风险阈值覆盖四个等级边界", function() {
  assert.strictEqual(scoring.getRiskBand(34, scoring.DEFAULT_THRESHOLDS).level, "正常")
  assert.strictEqual(scoring.getRiskBand(35, scoring.DEFAULT_THRESHOLDS).level, "关注")
  assert.strictEqual(scoring.getRiskBand(55, scoring.DEFAULT_THRESHOLDS).level, "较高风险")
  assert.strictEqual(scoring.getRiskBand(75, scoring.DEFAULT_THRESHOLDS).level, "紧急风险")
})

test("关键题可提升最终风险等级", function() {
  const outcome = scoring.scoreAssessment({
    assessmentId: 2,
    questions: [question(19, [1, 2, 3, 4])],
    answers: { 0: 2 },
    rule: scoring.getRule(2)
  })
  assert.strictEqual(outcome.triggeredRules[0].code, "SDS_Q19_SAFETY")
  assert.strictEqual(outcome.riskLevel, "紧急风险")
})

test("缺题时结果标记为不完整", function() {
  const outcome = scoring.scoreAssessment({
    assessmentId: 1,
    questions: [question(1, [1, 2, 3, 4]), question(2, [1, 2, 3, 4])],
    answers: { 0: 0 },
    rule: scoring.getRule(1)
  })
  assert.strictEqual(outcome.complete, false)
  assert.deepStrictEqual(outcome.missingQuestionIds, [2])
  assert.strictEqual(outcome.completionRate, 50)
})

test("任务请求未知评分版本时拒绝静默换算", function() {
  assert.throws(function() { scoring.getRule(1, "1.0.0") }, /评分规则版本不可用/)
})

test("结果保存问卷、评分和答案快照", function() {
  const questions = [question(1, [1, 2, 3, 4])]
  const rule = scoring.getRule(1)
  const outcome = scoring.scoreAssessment({ assessmentId: 1, questions: questions, answers: { 0: 1 }, rule: rule })
  const snapshot = scoring.createResultSnapshot({
    id: 88,
    now: new Date("2026-08-06T00:00:00.000Z"),
    studentId: "2024001",
    assessment: { id: 1, name: "测试量表", questionnaireVersion: "1.0.0" },
    task: { id: 10, questionnaireVersion: "1.0.0", scoringVersion: "2.0.0" },
    semester: { id: "2026-1", name: "2026-2027学年第一学期" },
    questions: questions,
    outcome: outcome,
    rule: rule
  })
  rule.thresholds[0].level = "被修改"
  questions[0].title = "被修改"
  assert.strictEqual(snapshot.scoringSnapshot.thresholds[0].level, "正常")
  assert.strictEqual(snapshot.questionnaireSnapshot.questions[0].title, "题目1")
  assert.strictEqual(snapshot.semesterId, "2026-1")
  assert.strictEqual(snapshot.scoringVersion, "2.0.0")
  assert.strictEqual(snapshot.answerSnapshot.length, 1)
})

console.log("\n评分引擎测试全部通过")
