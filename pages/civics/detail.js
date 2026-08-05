Page({
  data: { article: {} },
  onLoad(options) {
    const article = (wx.getStorageSync("civicsArticles") || []).find(item => item.id === parseInt(options.id)) || {}
    this.setData({ article })
  },
  onShareAppMessage() { return { title: this.data.article.title || "成长与价值", path: "/pages/civics/detail?id=" + this.data.article.id } }
})
