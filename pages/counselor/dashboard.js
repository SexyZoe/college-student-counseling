const auth = require('../../utils/auth')
const apiClient = require('../../utils/api-client')

Page({
  data: { user: {}, stats: {}, classes: [], recentRisks: [] },
  onShow() { const user = auth.requireRole('counselor'); if (!user) return; this.setData({ user }); this.loadDashboard(); this.loadRemoteDashboard() },
  loadDashboard() {
    const students = wx.getStorageSync("classStudents") || []
    const risks = wx.getStorageSync("riskEvents") || []
    const ids = this.data.user.classIds || []
    const ownStudents = students.filter(item => ids.indexOf(item.classId) >= 0)
    const grouped = {}
    ownStudents.forEach(item => {
      if (!grouped[item.classId]) grouped[item.classId] = { id: item.classId, name: item.className, total: 0, completed: 0, highRisk: 0 }
      grouped[item.classId].total++
      if (item.completion === "已完成") grouped[item.classId].completed++
      if (item.riskLevel === "较高风险" || item.riskLevel === "紧急风险") grouped[item.classId].highRisk++
    })
    const classes = Object.values(grouped).map(item => { item.rate = item.total ? Math.round(item.completed / item.total * 100) : 0; return item })
    this.setData({
      classes,
      recentRisks: risks.slice().sort((a,b) => b.id - a.id).slice(0, 3),
      stats: { classCount: classes.length, studentCount: ownStudents.length, completionRate: ownStudents.length ? Math.round(ownStudents.filter(item => item.completion === "已完成").length / ownStudents.length * 100) : 0, pendingRisk: risks.filter(item => item.status === "待确认").length }
    })
  },
  loadRemoteDashboard() {
    if (!apiClient.getSettings().enabled) return
    Promise.all([apiClient.getCounselorClasses(), apiClient.getRiskEvents()]).then(results => {
      const classes = results[0]
      const risks = results[1]
      wx.setStorageSync("riskEvents", risks)
      const studentCount = classes.reduce((sum, item) => sum + item.total, 0)
      const completed = classes.reduce((sum, item) => sum + item.completed, 0)
      this.setData({
        classes,
        recentRisks: risks.slice(0, 3),
        stats: { classCount: classes.length, studentCount, completionRate: studentCount ? Math.round(completed / studentCount * 100) : 0, pendingRisk: risks.filter(item => item.status === "待确认").length }
      })
    }).catch(error => wx.setStorageSync("backendLastError", { code:error.code, message:error.message, time:Date.now() }))
  },
  goClass(e) { wx.navigateTo({ url: "/pages/counselor/class-detail?id=" + e.currentTarget.dataset.id }) },
  goRisks() { wx.navigateTo({ url: "/pages/counselor/risks" }) },
  goContent() { wx.navigateTo({ url: "/pages/counselor/content" }) },
  logout() { auth.logout("辅导员主动退出").then(() => wx.reLaunch({ url: "/pages/login/login" })) }
})
