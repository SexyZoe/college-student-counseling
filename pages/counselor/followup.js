const auth = require('../../utils/auth')
Page({
  data: { event: {}, statuses: ["已联系", "待联系", "已转介", "已关闭"], selectedStatus: "", note: "" },
  onLoad(options) { if (!auth.requireRole('counselor')) return; const event = (wx.getStorageSync("riskEvents") || []).find(item => item.id === parseInt(options.id)) || {}; this.setData({ event }) },
  selectStatus(e) { this.setData({ selectedStatus: e.currentTarget.dataset.status }) },
  onNote(e) { this.setData({ note: e.detail.value }) },
  save() {
    if (!this.data.selectedStatus) return wx.showToast({ title: "请选择跟进状态", icon: "none" })
    if (!this.data.note.trim()) return wx.showToast({ title: "请填写必要记录", icon: "none" })
    const user = wx.getStorageSync("userInfo") || {}
    const records = wx.getStorageSync("followupRecords") || []
    records.push({ id: Date.now(), riskEventId: this.data.event.id, studentId: this.data.event.studentId, operator: user.name || user.nickName, status: this.data.selectedStatus, note: this.data.note.trim(), time: new Date().toLocaleString() })
    wx.setStorageSync("followupRecords", records)
    let risks = wx.getStorageSync("riskEvents") || []
    risks = risks.map(item => { if (item.id === this.data.event.id) item.status = this.data.selectedStatus === "已关闭" ? "已关闭" : "跟进中"; return item })
    wx.setStorageSync("riskEvents", risks)
    wx.showToast({ title: "跟进记录已保存", icon: "success" }); setTimeout(() => wx.navigateBack(), 500)
  }
})
