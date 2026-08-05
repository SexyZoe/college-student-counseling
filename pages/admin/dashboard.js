Page({
  data: { user: {}, stats: {}, logs: [] },
  onShow() { const user = wx.getStorageSync("userInfo") || {}; if (user.role !== "admin") return wx.reLaunch({ url: "/pages/login/login" }); const content = wx.getStorageSync("civicsArticles") || []; this.setData({ user, stats: { semesters: (wx.getStorageSync("semesters") || []).length, students: (wx.getStorageSync("classStudents") || []).length, tasks: (wx.getStorageSync("assessmentTasks") || []).length, pendingContent: content.filter(item => item.status === "待审核").length }, logs: (wx.getStorageSync("auditLogs") || []).slice().reverse().slice(0,6) }) },
  goData() { wx.navigateTo({ url: "/pages/admin/data" }) }, goTasks() { wx.navigateTo({ url: "/pages/admin/tasks" }) }, goContent() { wx.navigateTo({ url: "/pages/admin/content" }) },
  logout() { wx.removeStorageSync("userInfo"); wx.reLaunch({ url: "/pages/login/login" }) }
})
