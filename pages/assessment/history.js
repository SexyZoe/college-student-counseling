// pages/assessment/history.js
const auth = require('../../utils/auth')
Page({
  data: {
    assessmentId: 0,
    assessmentName: "",
    historyList: [],
    trendDirection: "",
    trendColor: "#8fc8b5"
  },

  onLoad: function(options) {
    if (!auth.requireRole('student')) return;
    var id = parseInt(options.id) || 1;
    var allResults = wx.getStorageSync("assessmentResults") || [];
    var filtered = allResults.filter(function(r) { return r.assessmentId === id; });
    filtered.sort(function(a, b) { return a.id - b.id; });

    var assessments = wx.getStorageSync("assessments") || [];
    var current = assessments.find(function(a) { return a.id === id; });
    var name = current ? current.name : "测评";

    // 分析趋势
    var trend = "保持稳定";
    var trendColor = "#8fc8b5";
    if (filtered.length >= 2) {
      var first = filtered[0].normalizedRiskScore !== undefined ? filtered[0].normalizedRiskScore : filtered[0].score;
      var lastItem = filtered[filtered.length - 1];
      var last = lastItem.normalizedRiskScore !== undefined ? lastItem.normalizedRiskScore : lastItem.score;
      if (last < first) { trend = "呈下降趋势 ↓"; trendColor = "#8fc8b5"; }
      else if (last > first) { trend = "呈上升趋势 ↑"; trendColor = "#f4a3a8"; }
    }

    this.setData({
      assessmentId: id,
      assessmentName: name,
      historyList: filtered,
      trendDirection: trend,
      trendColor: trendColor
    });
  },

  onTapItem: function(e) {
    var id = e.currentTarget.dataset.id;
    var item = this.data.historyList.find(function(r) { return r.id === id; });
    if (item) {
      wx.navigateTo({
        url: "/pages/assessment/result?id=" + item.assessmentId + "&resultId=" + item.id + "&readonly=1"
      });
    }
  },

  goBack: function() { wx.navigateBack(); }
});
