const auth = require('../../utils/auth')
const apiClient = require('../../utils/api-client')
Page({
  data: { student: {}, results: [], risk: null },
  onLoad(options) {
    if (!auth.requireRole('counselor')) return
    const id = options.id
    const student = (wx.getStorageSync("classStudents") || []).find(item => item.studentId === id) || {}
    const results = (wx.getStorageSync("assessmentResults") || []).filter(item => item.studentId === id)
    const risk = (wx.getStorageSync("riskEvents") || []).find(item => item.studentId === id) || null
    this.setData({ student, results, risk })
    if (apiClient.getSettings().enabled) {
      apiClient.getStudentSupportSummary(id).then(summary => this.setData(summary)).catch(error => wx.setStorageSync("backendLastError", { code:error.code, message:error.message, time:Date.now() }))
    }
    const logs = wx.getStorageSync("auditLogs") || []
    logs.push({ id: Date.now(), operator: (wx.getStorageSync("userInfo") || {}).name || "辅导员", action: "查看学生支持摘要 " + id, time: new Date().toLocaleString() })
    wx.setStorageSync("auditLogs", logs)
  },
  followup() { if (this.data.risk) wx.navigateTo({ url: "/pages/counselor/followup?id=" + this.data.risk.id }); else wx.showToast({ title: "当前没有风险事件", icon: "none" }) }
})
