Page({
  data: { categories: ["全部", "理想信念", "网络素养", "社会实践"], activeCategory: "全部", articles: [], filteredArticles: [] },
  onShow() { this.loadArticles() },
  loadArticles() {
    const articles = (wx.getStorageSync("civicsArticles") || []).filter(item => item.status === "已发布")
    this.setData({ articles })
    this.filterArticles()
  },
  onCategoryTap(e) { this.setData({ activeCategory: e.currentTarget.dataset.category }); this.filterArticles() },
  filterArticles() {
    const category = this.data.activeCategory
    this.setData({ filteredArticles: category === "全部" ? this.data.articles : this.data.articles.filter(item => item.category === category) })
  },
  onArticleTap(e) { wx.navigateTo({ url: "/pages/civics/detail?id=" + e.currentTarget.dataset.id }) }
})
