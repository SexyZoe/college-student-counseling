// utils/question-types.js
// 复杂题型定义与随机化工具

// 题型常量
var QT_SINGLE = "single";       // 单选（默认）
var QT_MULTIPLE = "multiple";    // 多选
var QT_MATRIX = "matrix";        // 矩阵量表
var QT_BOOLEAN = "boolean";      // 是非

// 检测题目类型
function detectType(question) {
  if (!question) return QT_SINGLE;
  if (question.type === QT_MULTIPLE) return QT_MULTIPLE;
  if (question.type === QT_MATRIX) return QT_MATRIX;
  if (question.type === QT_BOOLEAN) return QT_BOOLEAN;
  return QT_SINGLE;
}

// Fisher-Yates 洗牌算法
function shuffle(arr) {
  var result = (arr || []).slice();
  for (var i = result.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

// 随机题目顺序（保留原 id 映射）
function shuffleQuestions(questions) {
  if (!questions || !questions.length) return { list: questions, orderMap: null };
  var shuffled = shuffle(questions);
  var orderMap = {};
  for (var i = 0; i < shuffled.length; i++) {
    orderMap[i] = shuffled[i].id;
  }
  return { list: shuffled, orderMap: orderMap };
}

// 随机选项顺序
function shuffleOptions(question) {
  if (!question || !question.options || question.options.length < 2) return question;
  var q = JSON.parse(JSON.stringify(question));
  q.options = shuffle(q.options);
  q._originalOptions = question.options;  // 保留原始顺序供评分引擎使用
  return q;
}

// 获取原始选项（从打乱后的选项中恢复）
function getOriginalOptionIndex(question, shuffledIdx) {
  if (!question._originalOptions) return shuffledIdx;
  var shuffledOpt = question.options[shuffledIdx];
  if (!shuffledOpt) return shuffledIdx;
  for (var i = 0; i < question._originalOptions.length; i++) {
    if (question._originalOptions[i].label === shuffledOpt.label &&
        question._originalOptions[i].text === shuffledOpt.text) {
      return i;
    }
  }
  return shuffledIdx;
}

// 创建矩阵题
// rows: [{id:"r1",text:"题目1"},...]
// columns: [{label:"1",text:"完全不符合",score:1},...]
function createMatrixQuestion(id, title, rows, columns) {
  return {
    id: id,
    type: QT_MATRIX,
    title: title,
    rows: rows || [],
    columns: columns || [
      { label: "1", text: "完全不符合", score: 1 },
      { label: "2", text: "比较不符合", score: 2 },
      { label: "3", text: "一般", score: 3 },
      { label: "4", text: "比较符合", score: 4 },
      { label: "5", text: "完全符合", score: 5 }
    ],
    minRows: 0
  };
}

// 创建多选题
function createMultipleChoiceQuestion(id, title, options, config) {
  return {
    id: id,
    type: QT_MULTIPLE,
    title: title,
    options: options || [],
    minSelect: (config && config.minSelect) || 1,
    maxSelect: (config && config.maxSelect) || (options ? options.length : 99)
  };
}

// 创建是非题
function createBooleanQuestion(id, title, scoreTrue, scoreFalse) {
  return {
    id: id,
    type: QT_BOOLEAN,
    title: title,
    scoreTrue: scoreTrue !== undefined ? scoreTrue : 1,
    scoreFalse: scoreFalse !== undefined ? scoreFalse : 0
  };
}

// 验证多选答案
function validateMultipleAnswer(question, answer) {
  if (!Array.isArray(answer)) return { valid: false, message: "答案格式错误" };
  var min = question.minSelect || 1;
  var max = question.maxSelect || (question.options ? question.options.length : 99);
  if (answer.length < min) return { valid: false, message: "请至少选择 " + min + " 项" };
  if (answer.length > max) return { valid: false, message: "最多只能选择 " + max + " 项" };
  for (var i = 0; i < answer.length; i++) {
    if (typeof answer[i] !== "number" || answer[i] < 0 || answer[i] >= (question.options ? question.options.length : 0)) {
      return { valid: false, message: "选项序号超出范围" };
    }
  }
  return { valid: true };
}

// 验证矩阵答案
function validateMatrixAnswer(question, answer) {
  if (!answer || typeof answer !== "object") return { valid: false, message: "请完成所有行" };
  var rows = question.rows || [];
  for (var i = 0; i < rows.length; i++) {
    var rowId = rows[i].id;
    var val = answer[rowId];
    if (val === undefined || val === null || val < 0 || val >= (question.columns ? question.columns.length : 0)) {
      return { valid: false, message: "请完成第" + (i + 1) + "行" };
    }
  }
  return { valid: true };
}

module.exports = {
  QT_SINGLE: QT_SINGLE,
  QT_MULTIPLE: QT_MULTIPLE,
  QT_MATRIX: QT_MATRIX,
  QT_BOOLEAN: QT_BOOLEAN,
  detectType: detectType,
  shuffle: shuffle,
  shuffleQuestions: shuffleQuestions,
  shuffleOptions: shuffleOptions,
  getOriginalOptionIndex: getOriginalOptionIndex,
  createMatrixQuestion: createMatrixQuestion,
  createMultipleChoiceQuestion: createMultipleChoiceQuestion,
  createBooleanQuestion: createBooleanQuestion,
  validateMultipleAnswer: validateMultipleAnswer,
  validateMatrixAnswer: validateMatrixAnswer
};
