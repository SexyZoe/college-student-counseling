const auth = require('../../utils/auth')
const apiClient = require('../../utils/api-client')
Page({
  data: { title: "", category: "理想信念", summary: "", content: "", categories: ["理想信念", "网络素养", "社会实践"], drafts: [] },
  onShow() {
    const user = auth.requireRole('counselor'); if (!user) return
    const drafts = (wx.getStorageSync("civicsArticles") || []).filter(item => item.author === (user.name || user.nickName))
    this.setData({ drafts })
    if (apiClient.getSettings().enabled) {
      apiClient.getMyCounselorContent().then(items => {
        this.setData({ drafts:items.map(item => Object.assign({}, item, { reviewer:item.reviewerName || "待管理员审核" })) })
      }).catch(error => wx.setStorageSync("backendLastError", { code:error.code, message:error.message, time:Date.now() }))
    }
  },
  onTitle(e) { this.setData({ title: e.detail.value }) }, onSummary(e) { this.setData({ summary: e.detail.value }) }, onContent(e) { this.setData({ content: e.detail.value }) },
  selectCategory(e) { this.setData({ category: e.currentTarget.dataset.category }) },
  submit() {
    if (!this.data.title.trim() || !this.data.content.trim()) return wx.showToast({ title: "请填写标题和正文", icon: "none" })
    if (apiClient.getSettings().enabled) {
      apiClient.submitCounselorContent({
        type:"civics", title:this.data.title.trim(), category:this.data.category,
        summary:this.data.summary.trim() || this.data.content.trim().slice(0, 50), content:this.data.content.trim()
      }).then(() => {
        wx.showToast({ title:"已提交审核", icon:"success" })
        this.setData({ title:"", summary:"", content:"" });this.onShow()
      }).catch(error => wx.showToast({ title:error.message || "提交失败", icon:"none" }))
      return
    }
    const user = wx.getStorageSync("userInfo") || {}
    const list = wx.getStorageSync("civicsArticles") || []
    list.unshift({ id: Date.now(), title: this.data.title.trim(), category: this.data.category, summary: this.data.summary.trim() || this.data.content.trim().slice(0, 50), content: this.data.content.trim(), author: user.name || user.nickName, reviewer: "待管理员审核", publishTime: "", status: "待审核" })
    wx.setStorageSync("civicsArticles", list)
    wx.showToast({ title: "已提交审核", icon: "success" }); this.setData({ title: "", summary: "", content: "" }); this.onShow()
  }
})
