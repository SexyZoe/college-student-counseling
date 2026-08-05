const auth = require('../../utils/auth')
Page({
  data: { filters: ["全部", "待确认", "跟进中", "已关闭"], activeFilter: "全部", risks: [], filtered: [] },
  onShow() { if (!auth.requireRole('counselor')) return; const risks = wx.getStorageSync("riskEvents") || []; this.setData({ risks, filtered: risks }); this.applyFilter() },
  onFilter(e) { this.setData({ activeFilter: e.currentTarget.dataset.filter }); this.applyFilter() },
  applyFilter() { const f = this.data.activeFilter; this.setData({ filtered: f === "全部" ? this.data.risks : this.data.risks.filter(item => item.status === f) }) },
  goFollowup(e) { wx.navigateTo({ url: "/pages/counselor/followup?id=" + e.currentTarget.dataset.id }) }
})
