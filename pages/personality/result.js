Page({
  data: { result: {} },
  onLoad() { this.setData({ result: wx.getStorageSync("personalityResult") || {} }) },
  goBack() { wx.redirectTo({ url: "/pages/personality/quiz?id=type16" }) }
})
