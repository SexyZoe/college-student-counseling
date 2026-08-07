const SCORING_VERSION = "2.0.0"
const QUESTIONNAIRE_VERSION = "1.0.0"

// 当前阈值用于产品原型和流程联调，不构成临床诊断标准；上线前必须由心理专业人员审定并形成新版本。
const DEFAULT_THRESHOLDS = [
  { min: 0, max: 34, level: "正常" },
  { min: 35, max: 54, level: "关注" },
  { min: 55, max: 74, level: "较高风险" },
  { min: 75, max: 100, level: "紧急风险" }
]

const RULES = {
  1: { direction: "risk_high", reverseQuestionIds: [5, 9, 13, 17, 19] },
  2: {
    direction: "risk_high",
    reverseQuestionIds: [2, 5, 6, 11, 12, 14, 16, 17, 18, 20],
    keyItems: [
      { questionId: 19, minScore: 3, level: "紧急风险", code: "SDS_Q19_SAFETY" }
    ]
  },
  3: {
    direction: "risk_high",
    reverseQuestionIds: [11, 12, 13],
    keyItems: [
      { questionId: 15, minScore: 4, level: "较高风险", code: "STUDY_EXHAUSTION" }
    ]
  },
  4: { direction: "risk_high", reverseQuestionIds: [7, 8, 9, 13, 14] },
  5: { direction: "risk_high", reverseQuestionIds: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12] },
  6: { direction: "health_high", reverseQuestionIds: [3, 5, 8, 9, 10] },
  7: {
    direction: "risk_high",
    reverseQuestionIds: [],
    keyItems: [
      { questionId: 9, minScore: 3, level: "关注", code: "SLEEP_MEDICATION" }
    ]
  },
  8: { direction: "health_high", reverseQuestionIds: [] }
}

const LEVEL_SEVERITY = { "正常": 0, "关注": 1, "较高风险": 2, "紧急风险": 3 }

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getRule(assessmentId, requestedVersion) {
  const base = RULES[parseInt(assessmentId)]
  if (!base) throw new Error("暂不支持该测评的评分规则")
  if (requestedVersion && requestedVersion !== SCORING_VERSION) {
    throw new Error("评分规则版本不可用：" + requestedVersion)
  }
  return clone(Object.assign({
    assessmentId: parseInt(assessmentId),
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    scoringVersion: SCORING_VERSION,
    scale: { min: 1, max: 4 },
    standardization: "linear-risk-0-100",
    thresholds: DEFAULT_THRESHOLDS,
    reverseQuestionIds: [],
    keyItems: []
  }, base))
}

function getRiskBand(riskScore, thresholds) {
  const score = clamp(Math.round(riskScore), 0, 100)
  for (let index = 0; index < thresholds.length; index++) {
    if (score >= thresholds[index].min && score <= thresholds[index].max) {
      return clone(thresholds[index])
    }
  }
  return clone(thresholds[thresholds.length - 1])
}

function scoreAssessment(options) {
  const questions = options.questions || []
  const answers = options.answers || {}
  const rule = options.rule || getRule(options.assessmentId)
  const reverseIds = rule.reverseQuestionIds || []
  const responseDetails = []
  const missingQuestionIds = []
  let rawScore = 0

  questions.forEach(function(question, index) {
    const selectedIndex = answers[index]
    if (selectedIndex === undefined || !question.options || !question.options[selectedIndex]) {
      missingQuestionIds.push(question.id)
      return
    }
    const originalScore = Number(question.options[selectedIndex].score)
    const reversed = reverseIds.indexOf(question.id) !== -1
    const scoredValue = reversed
      ? rule.scale.min + rule.scale.max - originalScore
      : originalScore
    rawScore += scoredValue
    responseDetails.push({
      questionId: question.id,
      selectedIndex: selectedIndex,
      originalScore: originalScore,
      scoredValue: scoredValue,
      reversed: reversed
    })
  })

  const answeredCount = responseDetails.length
  const minScore = answeredCount * rule.scale.min
  const maxScore = answeredCount * rule.scale.max
  const span = maxScore - minScore
  const linearScore = span > 0 ? ((rawScore - minScore) / span) * 100 : 0
  let normalizedRiskScore = rule.direction === "health_high" ? 100 - linearScore : linearScore
  normalizedRiskScore = clamp(Math.round(normalizedRiskScore), 0, 100)

  let band = getRiskBand(normalizedRiskScore, rule.thresholds)
  const triggeredRules = []
  ;(rule.keyItems || []).forEach(function(keyItem) {
    const response = responseDetails.find(function(item) { return item.questionId === keyItem.questionId })
    if (response && response.scoredValue >= keyItem.minScore) {
      triggeredRules.push({
        code: keyItem.code,
        questionId: keyItem.questionId,
        level: keyItem.level,
        scoredValue: response.scoredValue
      })
      if (LEVEL_SEVERITY[keyItem.level] > LEVEL_SEVERITY[band.level]) {
        band = { min: band.min, max: band.max, level: keyItem.level }
      }
    }
  })

  // 复杂题型加权（在原始分数基础上）
  if (options.complexTypes && Object.keys(options.complexTypes).length > 0) {
    var complexRaw = 0;
    var complexMin = 0;
    var complexMax = 0;
    var ctypes = options.complexTypes;
    for (var cIdx in ctypes) {
      if (!ctypes.hasOwnProperty(cIdx)) continue;
      var cInfo = ctypes[cIdx];
      if (cInfo.pattern === 'binary') {
        complexRaw += (cInfo.answer === 0 ? (cInfo.scoreTrue || 1) : (cInfo.scoreFalse || 0));
        complexMin += 0;
        complexMax += Math.max(cInfo.scoreTrue || 1, cInfo.scoreFalse || 0);
      } else if (cInfo.pattern === 'sum' && Array.isArray(cInfo.answer)) {
        for (var sIdx = 0; sIdx < cInfo.answer.length; sIdx++) {
          var opt = (cInfo.options || [])[cInfo.answer[sIdx]];
          complexRaw += opt ? (opt.score || 1) : 0;
        }
      } else if (cInfo.pattern === 'matrix') {
        var matAns = cInfo.answer || {};
        var matRows = cInfo.rows || [];
        var matCols = cInfo.columns || [];
        for (var r = 0; r < matRows.length; r++) {
          var colIdx = matAns[matRows[r].id];
          if (colIdx !== undefined && colIdx >= 0 && colIdx < matCols.length) {
            complexRaw += matCols[colIdx].score || 1;
          }
        }
        complexMin += matRows.length;
        complexMax += matRows.length * ((matCols[matCols.length - 1] && matCols[matCols.length - 1].score) || 5);
      }
    }
    if (complexMax > 0) {
      var complexLinear = ((complexRaw - complexMin) / (complexMax - complexMin)) * 100;
      complexLinear = clamp(Math.round(complexLinear), 0, 100);
      normalizedRiskScore = clamp(Math.round((normalizedRiskScore + complexLinear) / 2), 0, 100);
      band = getRiskBand(normalizedRiskScore, rule.thresholds);
    }
  }

  return {
    complete: missingQuestionIds.length === 0,
    missingQuestionIds: missingQuestionIds,
    answeredCount: answeredCount,
    questionCount: questions.length,
    completionRate: questions.length ? Math.round((answeredCount / questions.length) * 100) : 0,
    rawScore: rawScore,
    minScore: minScore,
    maxScore: maxScore,
    normalizedRiskScore: normalizedRiskScore,
    wellbeingIndex: 100 - normalizedRiskScore,
    riskLevel: band.level,
    triggeredRules: triggeredRules,
    responseDetails: responseDetails
  }
}

function createResultSnapshot(options) {
  const assessment = options.assessment || {}
  const task = options.task || {}
  const semester = options.semester || {}
  const outcome = options.outcome
  const rule = options.rule
  const questions = options.questions || []
  const now = options.now || new Date()
  const resultId = options.id || now.getTime()

  return {
    id: resultId,
    studentId: options.studentId || "demo-student",
    taskId: task.id || 0,
    assessmentId: assessment.id,
    assessmentName: assessment.name || "心理健康测评",
    score: outcome.rawScore,
    total: outcome.maxScore,
    stdScore: outcome.wellbeingIndex,
    normalizedRiskScore: outcome.normalizedRiskScore,
    level: outcome.riskLevel,
    riskLevel: outcome.riskLevel,
    completionRate: outcome.completionRate,
    triggeredRules: clone(outcome.triggeredRules),
    dimensions: [],
    semesterId: semester.id || task.semesterId || "",
    semesterName: semester.name || task.semester || "未关联学期",
    questionnaireVersion: task.questionnaireVersion || assessment.questionnaireVersion || rule.questionnaireVersion,
    scoringVersion: task.scoringVersion || rule.scoringVersion,
    questionnaireSnapshot: {
      id: assessment.id,
      name: assessment.name || "心理健康测评",
      version: task.questionnaireVersion || assessment.questionnaireVersion || rule.questionnaireVersion,
      questionCount: questions.length,
      questions: questions.map(function(question) {
        return {
          id: question.id,
          title: question.title,
          options: (question.options || []).map(function(option) {
            return { label: option.label, text: option.text, score: option.score }
          })
        }
      })
    },
    scoringSnapshot: clone(rule),
    answerSnapshot: clone(outcome.responseDetails),
    date: now.toISOString().slice(0, 10),
    createdAt: now.toISOString()
  }
}

function riskSeverity(level) {
  return LEVEL_SEVERITY[level] === undefined ? -1 : LEVEL_SEVERITY[level]
}

module.exports = {
  SCORING_VERSION: SCORING_VERSION,
  QUESTIONNAIRE_VERSION: QUESTIONNAIRE_VERSION,
  DEFAULT_THRESHOLDS: clone(DEFAULT_THRESHOLDS),
  getRule: getRule,
  getRiskBand: getRiskBand,
  scoreAssessment: scoreAssessment,
  createResultSnapshot: createResultSnapshot,
  riskSeverity: riskSeverity
}
