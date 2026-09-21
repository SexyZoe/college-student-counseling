const auth = require('../../utils/auth')
const apiClient = require('../../utils/api-client')

Page({
  data: { user: {}, stats: {}, logs: [] },
  onShow() {
    const user = auth.requireRole('admin')
    if (!user) return
    const content = wx.getStorageSync("civicsArticles") || []
    this.setData({ user, stats: { semesters: (wx.getStorageSync("semesters") || []).length, students: (wx.getStorageSync("classStudents") || []).length, tasks: (wx.getStorageSync("assessmentTasks") || []).length, pendingContent: content.filter(item => item.status === "待审核").length }, logs: (wx.getStorageSync("auditLogs") || []).slice().reverse().slice(0,6) })
    if (!apiClient.getSettings().enabled || !apiClient.getSession()) return
    Promise.all([
      apiClient.getAdminSemesters(),
      apiClient.getAdminStudents(),
      apiClient.getAdminAssessmentTasks(),
      apiClient.getAdminContent("", "待审核"),
      apiClient.getAdminAuditLogs(6)
    ]).then(results => {
      this.setData({
        stats:{ semesters:results[0].length, students:results[1].length, tasks:results[2].length, pendingContent:results[3].length },
        logs:results[4]
      })
    }).catch(error => wx.setStorageSync("backendLastError", { code:error.code || "DASHBOARD_SYNC_FAILED", message:error.message, time:Date.now() }))
  },
  goData() { wx.navigateTo({ url: "/pages/admin/data" }) }, goTasks() { wx.navigateTo({ url: "/pages/admin/tasks" }) }, goContent() { wx.navigateTo({ url: "/pages/admin/content" }) },
  logout() { auth.logout("管理员主动退出").then(() => wx.reLaunch({ url: "/pages/login/login" })) }
})
