// pages/index/index.js
const auth = require("../../utils/auth")
const semesterService = require("../../utils/semester")

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    currentSemester: null,
    bannerList: [],
    quickEntries: [],
    articles: [],
    civicsArticles: [],
    pendingTasks: [],
    recentResult: null,
    pendingAssessmentCount: 0,
    resultHistoryCount: 0,
    privacyNotice: "本测评结果仅用于心理健康教育和风险筛查参考，不构成医疗诊断。您的个人数据受隐私保护，不会公开给其他学生或用于无关评价。",
    semesterPhaseLabel: "",
    showPrivacy: true,
    recentResultLevelColor: "#999",
    recentResultRingPercent: 0
  },

  onLoad() {
    this.loadBasicData()
  },

  onShow() {
    const currentUser = auth.getCurrentUser()
    if (currentUser && currentUser.role !== "student") return auth.routeToRoleHome(currentUser)
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadBasicData()
  },

  onPullDownRefresh() {
    this.loadBasicData()
    wx.stopPullDownRefresh()
  },

  loadBasicData() {
    this.loadUserInfo()
    this.loadSemester()
    this.loadBanners()
    this.loadQuickEntries()
    this.loadArticles()
    this.loadCivicsArticles()
    this.loadPendingAssessments()
  },

  loadUserInfo() {
    const userInfo = auth.getCurrentUser()
    this.setData({ isLoggedIn: !!userInfo, userInfo: userInfo || null })
  },

  loadSemester() {
    const semester = semesterService.getCurrentSemester()
    if (!semester) {
      this.setData({ currentSemester: null, semesterPhaseLabel: "" })
      return
    }
    const now = new Date()
    const start = new Date(semester.startDate)
    const end = new Date(semester.endDate)
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    const passedDays = Math.ceil((now - start) / (1000 * 60 * 60 * 24))
    const passedDaysClamped = Math.max(0, Math.min(passedDays, totalDays))
    var phaseLabel = ""
    if (now < start) phaseLabel = "还未开始"
    else if (now > end) phaseLabel = "已结束"
    else phaseLabel = "第" + (passedDaysClamped + 1) + " 天 / 共" + totalDays + " 天"
    this.setData({ currentSemester: semester, semesterPhaseLabel: phaseLabel })
  },

  loadBanners() {
    this.setData({
      bannerList: [
        { id: 1, image: "/images/banners/banner_1.png", title: "关注心理健康，从了解自己开始" },
        { id: 2, image: "/images/banners/banner_2.png", title: "科学心理测评，助力自我成长" },
        { id: 3, image: "/images/banners/banner_3.png", title: "每日心理科普，守护心灵港湾" }
      ]
    })
  },

  loadQuickEntries() {
    this.setData({
      quickEntries: [
        { icon: "edit", title: "心理测评", path: "/pages/assessment/list", color: "#f4a3a8" },
        { icon: "bookmark-o", title: "心理资讯", path: "/pages/article/list", color: "#f5d79e" },
        { icon: "question-o", title: "常见问题", path: "/pages/faq/index", color: "#b8a9d4" },
        { icon: "smile-o", title: "人格探索", path: "/pages/personality/index", color: "#f7b7a0" },
        { icon: "friends-o", title: "成长与价值", path: "/pages/civics/index", color: "#8fc1e0" },
        { icon: "phone-o", title: "求助支持", path: "/pages/help/index", color: "#8fc8b5" }
      ]
    })
  },

  loadArticles() {
    var articles = wx.getStorageSync("articles") || []
    this.setData({ articles: articles.slice(0, 3) })
  },

  loadCivicsArticles() {
    var list = (wx.getStorageSync("civicsArticles") || []).filter(function(item) {
      return item.status === "已发布"
    })
    this.setData({ civicsArticles: list.slice(0, 2) })
  },

  loadPendingAssessments() {
    var self = this
    var user = auth.getCurrentUser()
    if (!user || user.role !== "student") {
      this.setData({
        pendingAssessmentCount: 0, pendingTasks: [], recentResult: null,
        resultHistoryCount: 0, recentResultLevelColor: "#999", recentResultRingPercent: 0
      })
      return
    }
    var currentSemester = semesterService.getCurrentSemester()
    var now = new Date()
    var allTasks = wx.getStorageSync("assessmentTasks") || []
    var tasks = allTasks.filter(function(item) {
      return !currentSemester || !item.semesterId || item.semesterId === currentSemester.id
    }).map(function(item) {
      var deadline = item.deadline ? new Date(item.deadline) : null
      var daysLeftStr = deadline ? self.calcDaysLeft(deadline, now) : ""
      return Object.assign({}, item, { daysLeftStr: daysLeftStr })
    })
    var allResults = wx.getStorageSync("assessmentResults") || []
    var results = allResults.filter(function(item) {
      return item.studentId === user.studentId
    })
    var pendingTasks = tasks.filter(function(item) {
      return !item.completed && item.status !== "已结束"
    }).sort(function(a, b) {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline.localeCompare(b.deadline)
    })
    var recentResult = null
    if (results.length) {
      recentResult = results.slice().sort(function(a, b) {
        if (!a.createdAt) return 1
        if (!b.createdAt) return -1
        return b.createdAt.localeCompare(a.createdAt)
      })[0]
    }
    // pre-compute risk level color and ring percent for WXML
    var levelColor = self.riskLevelColor(recentResult ? recentResult.level : "")
    var ringPercent = 0
    if (recentResult) {
      ringPercent = recentResult.stdScore || recentResult.wellbeingIndex || recentResult.normalizedRiskScore || 0
    }
    this.setData({
      pendingAssessmentCount: pendingTasks.length,
      pendingTasks: pendingTasks,
      recentResult: recentResult,
      resultHistoryCount: results.length,
      recentResultLevelColor: levelColor,
      recentResultRingPercent: ringPercent
    })
  },

  calcDaysLeft: function(deadline, now) {
    var diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24))
    if (diff < 0) return "已过期"
    if (diff === 0) return "今天截止"
    if (diff === 1) return "明天截止"
    if (diff <= 3) return "仅剩" + diff + "天"
    return "剩余" + diff + "天"
  },

  riskLevelColor: function(level) {
    var map = { "正常": "#8fc8b5", "关注": "#f5d79e", "较高风险": "#f4a3a8", "紧急风险": "#e06070" }
    return map[level] || "#999"
  },

  /* ---- 导航 ---- */

  onBannerTap: function(e) {
    var id = e.currentTarget.dataset.id
    if (id === 1 || id === 2) wx.switchTab({ url: "/pages/assessment/list" })
    else wx.navigateTo({ url: "/pages/article/list" })
  },

  onQuickEntryTap: function(e) {
    var path = e.currentTarget.dataset.path
    if (!path) return
    var tabPages = ["/pages/index/index", "/pages/assessment/list", "/pages/mine/mine"]
    if (tabPages.indexOf(path) >= 0) wx.switchTab({ url: path })
    else wx.navigateTo({ url: path })
  },

  onArticleTap: function(e) {
    wx.navigateTo({ url: "/pages/article/detail?id=" + e.currentTarget.dataset.id })
  },

  onTaskTap: function(e) {
    var aid = e.currentTarget.dataset.assessmentId
    var tid = e.currentTarget.dataset.taskId
    wx.navigateTo({ url: "/pages/assessment/detail?id=" + aid + "&taskId=" + tid })
  },

  onRecentResultTap: function() {
    var result = this.data.recentResult
    if (!result) return
    wx.navigateTo({ url: "/pages/assessment/result?id=" + result.assessmentId + "&resultId=" + result.id })
  },

  onViewHistory: function() {
    wx.navigateTo({ url: "/pages/assessment/history" })
  },

  onCivicsTap: function(e) {
    wx.navigateTo({ url: "/pages/civics/detail?id=" + e.currentTarget.dataset.id })
  },

  goMine: function() {
    wx.switchTab({ url: "/pages/mine/mine" })
  },

  goLogin: function() {
    wx.navigateTo({ url: "/pages/login/login" })
  },

  onClosePrivacy: function() {
    this.setData({ showPrivacy: false })
  }
})
