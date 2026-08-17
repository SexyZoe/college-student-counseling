// pages/assessment/result.js
var resultsData = {"sas":{"name":"情绪压力量表(SAS)","ranges":[{"min":20,"max":35,"level":"压力适度","levelColor":"#8fc8b5","levelDesc":"你的情绪压力处于适度范围，情绪状态良好。","key":"ok"},{"min":36,"max":49,"level":"压力偏高","levelColor":"#f5d79e","levelDesc":"存在压力偏高倾向，建议关注自我调节。","key":"slight"},{"min":50,"max":59,"level":"压力较高","levelColor":"#f7b7a0","levelDesc":"压力水平偏高，建议尝试放松训练并关注变化。","key":"moderate"},{"min":60,"max":80,"level":"压力过高","levelColor":"#f4a3a8","levelDesc":"压力水平较高，建议寻求专业心理帮助。","key":"high"}],"analysis":{"ok":"测评结果显示你的压力水平处于正常范围。你的情绪状态较为平稳，能够较好地应对日常生活中的各种事件。建议继续保持现有的生活习惯和社交节奏，适当关注自身情绪变化即可。","slight":"你的压力水平略高于正常范围，表现为在某些情境下可能会感到紧张和担忧。这在大学生群体中较为常见，通常与学业压力和生活变化有关。建议你可以通过规律运动、深呼吸练习和正念冥想来调节。","moderate":"你的压力量表得分处于中等偏高水平。你可能在日常生活中有多处感受到情绪紧张，且这些情绪已经开始影响到你的睡眠、食欲或社交。建议你积极进行放松训练，并考虑预约一次心理咨询。","high":"测评结果显示你的压力水平较高。你可能正在经历持续的不安、紧张和担忧，甚至在无明显压力源时也会感到紧张。这已经对你的日常生活造成了显著影响。强烈建议你尽快寻求专业心理咨询师的帮助。"},"suggestions":{"ok":["保持规律的作息和每周150分钟以上的运动","维持现有的社交支持网络","每天抽5分钟进行深呼吸练习"],"slight":["学习腹式呼吸法，每天早晚各练习5分钟","减少咖啡因和糖分摄入","写情绪日记记录压力触发因素","尝试使用冥想小程序每天10分钟"],"moderate":["预约一次校内心理咨询","练习渐进式肌肉放松法","每天安排30分钟的有氧运动","暂时减少学业负荷，优先保证睡眠"],"high":["尽快预约专业心理咨询","向信任的老师或辅导员说明情况","避免独自长时间封闭自己","如影响进食睡眠请同时就医"]}}};

if (!resultsData.sds) {
  resultsData.sds = resultsData.sas;
  resultsData.stress = resultsData.sas;
  resultsData.relate = resultsData.sas;
  resultsData.emotion = resultsData.sas;
  resultsData.self_esteem = resultsData.sas;
  resultsData.sleep = resultsData.sas;
  resultsData.resilience = resultsData.sas;
}

var scaleKeys = {1:"sas",2:"sds",3:"stress",4:"relate",5:"emotion",6:"self_esteem",7:"sleep",8:"resilience",9:"mbti"};
var auth = require('../../utils/auth');
var scoringEngine = require('../../utils/scoring-engine');

var RADAR_DIMENSIONS = [
  { key: "emotion", label: "情绪状态", desc: "情绪觉察与管理能力" },
  { key: "stress", label: "压力负荷", desc: "当前心理压力水平" },
  { key: "sleep", label: "睡眠精力", desc: "睡眠质量与日间精力" },
  { key: "social", label: "人际适应", desc: "人际关系与社交舒适度" },
  { key: "academic", label: "学业适应", desc: "学业压力与学习适应" }
];

var DIM_COLORS = ["#f4a3a8", "#f5d79e", "#8fc8b5", "#8fc1e0", "#b8a9d4"];

Page({
  data: {
    score: 0, total: 0, percentage: 0, stdScore: 0,
    level: "", levelColor: "", levelDesc: "",
    analysis: "", suggestions: [], assessmentName: "",
    assessmentId: 0, riskLevel: "正常",
    triggeredRules: [], dimensions: [],
    historyCount: 0,
    dimCards: [],
    wellbeingIndex: 0,
    trendArrows: [],
    lowestDimLabel: "",
    lowestDimAdvice: ""
  },

  onLoad: function(options) {
    if (!auth.requireRole('student')) return;
    var currentResults = wx.getStorageSync("assessmentResults") || [];
    var resultId = options.resultId || "";
    var storedResult = currentResults.find(function(item) { return String(item.id) === String(resultId); });
    var id = storedResult ? parseInt(storedResult.assessmentId) : (parseInt(options.id) || 1);
    if (id === 9) {
      this.handleMbtiResult(options);
      return;
    }

    var score = storedResult ? Number(storedResult.score) : (parseInt(options.score) || 20);
    var questionCount = storedResult && storedResult.questionnaireSnapshot
      ? storedResult.questionnaireSnapshot.questionCount
      : (parseInt(options.total) || 20);
    var maxScore = storedResult
      ? (storedResult.scoringSnapshot ? Number(storedResult.total) : Number(storedResult.total) * 4)
      : questionCount * 4;
    var percentage = storedResult && storedResult.normalizedRiskScore !== undefined
      ? storedResult.normalizedRiskScore
      : Math.round((score / maxScore) * 100);
    var stdScore = storedResult && storedResult.stdScore !== undefined ? storedResult.stdScore : percentage;
    var wellbeingIndex = storedResult && storedResult.wellbeingIndex !== undefined
      ? storedResult.wellbeingIndex
      : (100 - percentage);

    var key = scaleKeys[id] || "sas";
    var resultData = resultsData[key] || resultsData.sas;
    var level = "", levelColor = "", levelDesc = "", levelKey = "";
    var ranges = resultData.ranges || [];
    for (var i = 0; i < ranges.length; i++) {
      if (score >= ranges[i].min && score <= ranges[i].max) {
        level = ranges[i].level; levelColor = ranges[i].levelColor;
        levelDesc = ranges[i].levelDesc; levelKey = ranges[i].key || ""; break;
      }
    }
    if (!level && ranges.length) { level = ranges[0].level; levelColor = ranges[0].levelColor; levelDesc = ranges[0].levelDesc; levelKey = ranges[0].key || ""; }
    var storedLevel = storedResult && (storedResult.level || storedResult.riskLevel);
    var levelColors = { "正常": "#8fc8b5", "关注": "#f5d79e", "较高风险": "#f4a3a8", "紧急风险": "#e06070" };
    var levelDescriptions = {
      "正常": "当前评估未发现明显风险，建议保持规律作息和适度运动。",
      "关注": "部分维度需要关注，建议结合自评结果调整生活习惯。",
      "较高风险": "系统提示需要人工复核，请配合有权限的辅导员或专业人员进一步评估。",
      "紧急风险": "系统提示需要优先关注，请尽快联系可信任的人或学校心理中心。"
    };
    var levelKeys = { "正常": "ok", "关注": "slight", "较高风险": "moderate", "紧急风险": "high" };
    if (storedLevel && levelColors[storedLevel]) {
      level = storedLevel;
      levelColor = levelColors[storedLevel];
      levelDesc = levelDescriptions[storedLevel];
      levelKey = levelKeys[storedLevel] || "";
    }
    var analysis = resultData.analysis && resultData.analysis[levelKey] ? resultData.analysis[levelKey] : (resultData.analysis && resultData.analysis[level]) ? resultData.analysis[level] : "";
    if (!analysis) { analysis = resultData.analysis && resultData.analysis.ok ? resultData.analysis.ok : "请参考测评结果。"; }
    var suggestions = (resultData.suggestions && resultData.suggestions[levelKey]) || (resultData.suggestions && resultData.suggestions[level]) || [];

    // 五维数据：优先使用存储的真实维度，否则模拟生成
    var dimensions = storedResult && storedResult.dimensions && storedResult.dimensions.length >= 3
      ? storedResult.dimensions
      : this.generateDimensions(id, score, maxScore);

    // 构建维度详情卡片
    var dimCards = this.buildDimCards(dimensions);

    // 趋势对比：与上一次同量表结果比较
    var trendArrows = this.buildTrendArrows(dimensions, currentResults, id, resultId);

    // 最弱维度改善建议
    var lowest = this.findLowestDimension(dimensions);

    if (!storedResult && options.readonly !== "1") {
      var user = wx.getStorageSync("userInfo") || {};
      currentResults.push({
        id: Date.now(), studentId: user.studentId || "demo-student", taskId: parseInt(options.taskId) || 0,
        assessmentId: id, assessmentName: resultData.name,
        score: score, total: maxScore, stdScore: stdScore, level: level, riskLevel: this.mapRiskLevel(level),
        dimensions: dimensions, date: new Date().toISOString().slice(0, 10)
      });
      wx.setStorageSync("assessmentResults", currentResults);
    }

    this.setData({
      score: score, total: maxScore, percentage: percentage, stdScore: stdScore,
      level: level, levelColor: levelColor, levelDesc: levelDesc,
      analysis: analysis, suggestions: suggestions,
      assessmentName: storedResult ? storedResult.assessmentName : resultData.name, assessmentId: id,
      riskLevel: storedResult ? storedResult.riskLevel : this.mapRiskLevel(level),
      triggeredRules: storedResult ? (storedResult.triggeredRules || []) : [],
      dimensions: dimensions,
      historyCount: currentResults.filter(function(r) { return r.assessmentId === id; }).length,
      dimCards: dimCards,
      wellbeingIndex: wellbeingIndex,
      trendArrows: trendArrows,
      lowestDimLabel: lowest.label,
      lowestDimAdvice: lowest.advice
    });

    var that = this;
    setTimeout(function() { that.drawRadar(); }, 300);
  },

  /* 构建维度详情卡片 */
  buildDimCards: function(dimensions) {
    var that = this;
    return dimensions.map(function(dim, i) {
      var val = dim.value || 0;
      var status = val >= 70 ? "良好" : (val >= 40 ? "一般" : "需关注");
      var statusColor = val >= 70 ? "#8fc8b5" : (val >= 40 ? "#f5d79e" : "#f4a3a8");
      return {
        label: dim.label,
        value: val,
        status: status,
        statusColor: statusColor,
        barColor: DIM_COLORS[i % DIM_COLORS.length]
      };
    });
  },

  /* 趋势对比：与上一次结果比较 */
  buildTrendArrows: function(currentDims, allResults, assessmentId, currentResultId) {
    var previous = [];
    for (var i = allResults.length - 1; i >= 0; i--) {
      var r = allResults[i];
      if (r.assessmentId === assessmentId && String(r.id) !== String(currentResultId) && r.dimensions && r.dimensions.length) {
        previous = r.dimensions; break;
      }
    }
    if (!previous.length) return currentDims.map(function() { return ""; });
    return currentDims.map(function(dim, i) {
      if (!previous[i]) return "";
      var diff = dim.value - (previous[i].value || 0);
      if (Math.abs(diff) < 3) return "→";
      return diff > 0 ? "↑" : "↓";
    });
  },

  /* 找出最弱维度并给出建议 */
  findLowestDimension: function(dimensions) {
    if (!dimensions.length) return { label: "", advice: "" };
    var minIdx = 0;
    for (var i = 1; i < dimensions.length; i++) {
      if (dimensions[i].value < dimensions[minIdx].value) minIdx = i;
    }
    var dim = dimensions[minIdx];
    var advices = {
      "情绪状态": "建议尝试每日情绪日记，记录情绪变化与触发因素",
      "压力负荷": "建议学习腹式呼吸法和渐进式肌肉放松",
      "睡眠精力": "建议固定作息时间，睡前1小时减少屏幕使用",
      "人际适应": "建议从小型社交开始练习，逐步建立舒适感",
      "学业适应": "建议合理规划学习计划，拆分大目标为小任务，劳逸结合"
    };
    return { label: dim.label, advice: advices[dim.label] || ("建议关注" + dim.label + "这一维度") };
  },

  generateDimensions: function(assessmentId, totalScore, maxScore) {
    var basePercent = (totalScore / maxScore * 100);
    var weights = {
      1: [1.3, 1.1, 0.9, 0.7, 1.0],
      2: [1.2, 0.9, 1.0, 0.8, 1.1],
      3: [0.8, 1.4, 0.9, 0.7, 1.0],
      4: [0.7, 0.8, 0.6, 1.5, 1.1],
      5: [1.4, 0.9, 0.7, 0.8, 0.8],
      6: [0.6, 0.7, 0.6, 0.8, 1.5],
      7: [0.8, 1.0, 1.4, 0.6, 0.7],
      8: [0.9, 1.1, 0.7, 0.8, 1.2]
    };
    var w = weights[assessmentId] || [1.0, 1.0, 1.0, 1.0, 1.0];
    return RADAR_DIMENSIONS.map(function(dim, i) {
      var val = Math.round(basePercent * w[i]);
      var offset = ((assessmentId * 7 + i * 3) % 9) - 4;
      val = Math.max(10, Math.min(100, val + offset));
      return { label: dim.label, value: val, max: 100 };
    });
  },

  mapRiskLevel: function(level) {
    if (/过高|严重|困难|较低/.test(level)) return "较高风险";
    if (/偏高|较高|中度|轻微|一般|偏低/.test(level)) return "关注";
    return "正常";
  },

  drawRadar: function() {
    var query = wx.createSelectorQuery();
    var that = this;
    query.select("#radarCanvas").fields({ node: true, size: true }).exec(function(res) {
      if (!res || !res[0]) return;
      var canvas = res[0].node;
      var ctx = canvas.getContext("2d");
      var width = res[0].width;
      var height = res[0].height;
      var dpr = wx.getWindowInfo().pixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      var dims = that.data.dimensions;
      if (dims.length < 3) return;
      var cx = width / 2, cy = height / 2;
      var radius = Math.min(cx, cy) - 30;
      var count = dims.length;
      var angleStep = (2 * Math.PI) / count;

      // 背景网格
      for (var g = 1; g <= 5; g++) {
        ctx.beginPath();
        var r = (radius * g) / 5;
        for (var i = 0; i <= count; i++) {
          var a = -Math.PI / 2 + angleStep * i;
          var x = cx + r * Math.cos(a);
          var y = cy + r * Math.sin(a);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = "#eee";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // 轴线
      for (var i = 0; i < count; i++) {
        var a = -Math.PI / 2 + angleStep * i;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
        ctx.strokeStyle = "#ddd";
        ctx.stroke();
      }

      // 数据区
      ctx.beginPath();
      for (var i = 0; i < count; i++) {
        var val = dims[i].value / 100;
        var a = -Math.PI / 2 + angleStep * i;
        var x = cx + radius * val * Math.cos(a);
        var y = cy + radius * val * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = that.data.levelColor ? (that.data.levelColor + "30") : "#f4a3a830";
      ctx.fill();
      ctx.strokeStyle = that.data.levelColor || "#f4a3a8";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 数据点 + 数值标签
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#666";
      ctx.textAlign = "center";
      for (var i = 0; i < count; i++) {
        var val = dims[i].value / 100;
        var a = -Math.PI / 2 + angleStep * i;
        var x = cx + radius * val * Math.cos(a);
        var y = cy + radius * val * Math.sin(a);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = that.data.levelColor || "#f4a3a8";
        ctx.fill();
        ctx.fillStyle = "#444";
        ctx.fillText(dims[i].value + "", x, y - 10);
      }

      // 维度标签
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#666";
      for (var i = 0; i < count; i++) {
        var a = -Math.PI / 2 + angleStep * i;
        var lx = cx + (radius + 20) * Math.cos(a);
        var ly = cy + (radius + 20) * Math.sin(a);
        ctx.fillText(dims[i].label, lx, ly);
      }
    });
  },

  handleMbtiResult: function(options) {
    var mbti = require("../../utils/mbti");
    var type = options.type || "ISTJ";
    var scores = {};
    try { scores = JSON.parse(options.scores || "{}"); } catch(e) {}
    var result = mbti.MBTI_RESULTS[type] || mbti.MBTI_RESULTS["ISTJ"];
    var dims = [];
    var dimOrder = ["EI", "SN", "TF", "JP"];
    for (var i = 0; i < dimOrder.length; i++) {
      var d = dimOrder[i];
      var info = mbti.MBTI_DIMENSIONS[d];
      dims.push({ label: info.left + "/" + info.right, leftPct: scores[type[0]] || 50, rightPct: scores[type[1]] || 50 });
    }
    this.setData({
      score: 0, total: 28, percentage: 100, stdScore: 0,
      level: result.name, levelColor: result.color, levelDesc: result.title,
      analysis: result.description,
      suggestions: ["优势特质：" + result.strengths, "适合职业方向：" + result.careers],
      assessmentName: "MBTI人格类型测试", assessmentId: 9,
      mbtiType: type, dims: dims, historyCount: 0
    });
  },

  viewHistory: function() {
    wx.navigateTo({ url: "/pages/assessment/history?id=" + this.data.assessmentId });
  },

  goHelp: function() { wx.navigateTo({ url: "/pages/help/index" }); },
  goBack: function() { wx.navigateBack(); },
  onShare: function() {}
});
