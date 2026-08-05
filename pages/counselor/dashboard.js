const auth = require('../../utils/auth')

Page({
  data: { user: {}, stats: {}, classes: [], recentRisks: [] },
  onShow() { const user = auth.requireRole('counselor'); if (!user) return; this.setData({ user }); this.loadDashboard() },
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
      if (item.riskLevel === "较高风险") grouped[item.classId].highRisk++
    })
    const classes = Object.values(grouped).map(item => { item.rate = item.total ? Math.round(item.completed / item.total * 100) : 0; return item })
    this.setData({
      classes,
      recentRisks: risks.slice().sort((a,b) => b.id - a.id).slice(0, 3),
      stats: { classCount: classes.length, studentCount: ownStudents.length, completionRate: ownStudents.length ? Math.round(ownStudents.filter(item => item.completion === "已完成").length / ownStudents.length * 100) : 0, pendingRisk: risks.filter(item => item.status === "待确认").length }
    })
  },
  goClass(e) { wx.navigateTo({ url: "/pages/counselor/class-detail?id=" + e.currentTarget.dataset.id }) },
  goRisks() { wx.navigateTo({ url: "/pages/counselor/risks" }) },
  goContent() { wx.navigateTo({ url: "/pages/counselor/content" }) },
  logout() { auth.clearSession("辅导员主动退出"); wx.reLaunch({ url: "/pages/login/login" }) }
})
