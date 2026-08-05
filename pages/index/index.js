// pages/index/index.js
const auth = require("../../utils/auth")

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    bannerList: [],
    quickEntries: [],
    articles: [],
    civicsArticles: [],
    pendingTasks: [],
    recentResult: null,
    currentSemester: "2026-2027学年第一学期",
    pendingAssessmentCount: 0,
    privacyNotice: "本测评结果仅用于心理健康教育和风险筛查参考，不构成医疗诊断。您的个人数据受隐私保护，不会公开给其他学生或用于无关评价。",
    showPrivacy: true
  },

  onLoad() {
    this.loadUserInfo()
    this.loadBanners()
    this.loadQuickEntries()
    this.loadArticles()
    this.loadCivicsArticles()
    this.loadPendingAssessments()
  },

  onShow() {
    const currentUser = auth.getCurrentUser()
    if (currentUser && currentUser.role !== "student") return auth.routeToRoleHome(currentUser)
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadUserInfo()
    this.loadPendingAssessments()
  },

  loadUserInfo() {
    const userInfo = auth.getCurrentUser()
    this.setData({
      isLoggedIn: !!userInfo,
      userInfo: userInfo || null
    })
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
    const articles = wx.getStorageSync("articles") || []
    this.setData({ articles: articles.slice(0, 4) })
  },

  loadCivicsArticles() {
    const list = (wx.getStorageSync("civicsArticles") || []).filter(item => item.status === "已发布")
    this.setData({ civicsArticles: list.slice(0, 2) })
  },

  loadPendingAssessments() {
    const user = auth.getCurrentUser()
    if (!user || user.role !== "student") {
      this.setData({ pendingAssessmentCount: 0, pendingTasks: [], recentResult: null })
      return
    }
    const tasks = wx.getStorageSync("assessmentTasks") || []
    const results = (wx.getStorageSync("assessmentResults") || []).filter(item => item.studentId === user.studentId)
    const pendingTasks = tasks.filter(item => !item.completed && item.status !== "已结束")
    const recentResult = results.length ? results.slice().sort((a, b) => b.id - a.id)[0] : null
    this.setData({ pendingAssessmentCount: pendingTasks.length, pendingTasks, recentResult })
  },

  onBannerTap(e) {
    const id = e.currentTarget.dataset.id
    if (id === 1) wx.switchTab({ url: "/pages/assessment/list" })
  },

  onQuickEntryTap(e) {
    const path = e.currentTarget.dataset.path
    if (!path) return
    const tabPages = ["/pages/index/index", "/pages/assessment/list", "/pages/mine/mine"]
    if (tabPages.includes(path)) {
      wx.switchTab({ url: path })
    } else {
      wx.navigateTo({ url: path })
    }
  },

  onArticleTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: "/pages/article/detail?id=" + id })
  },

  onTaskTap(e) {
    wx.navigateTo({ url: "/pages/assessment/detail?id=" + e.currentTarget.dataset.assessmentId + "&taskId=" + e.currentTarget.dataset.taskId })
  },

  onCivicsTap(e) {
    wx.navigateTo({ url: "/pages/civics/detail?id=" + e.currentTarget.dataset.id })
  },

  goMine() {
    wx.switchTab({ url: "/pages/mine/mine" })
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" })
  },

  onClosePrivacy() {
    this.setData({ showPrivacy: false })
  }
})
