Page({
  data: { sensitiveConsent: false, consentTime: "" },
  onLoad() {
    const record = wx.getStorageSync("privacyConsent") || {}
    this.setData({ sensitiveConsent: !!record.agreed, consentTime: record.time || "" })
  },
  onConsentChange(e) {
    const agreed = e.detail
    const time = agreed ? new Date().toLocaleString() : ""
    wx.setStorageSync("privacyConsent", { agreed, time, version: "1.0" })
    const records = wx.getStorageSync("consentRecords") || []
    records.push({ type: "privacy", agreed, time: time || new Date().toLocaleString(), version: "1.0" })
    wx.setStorageSync("consentRecords", records)
    this.setData({ sensitiveConsent: agreed, consentTime: time })
    wx.showToast({ title: agreed ? "授权记录已保存" : "已撤回可撤回授权", icon: "none" })
  }
})
