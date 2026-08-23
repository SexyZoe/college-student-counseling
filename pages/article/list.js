// pages/article/list.js
var util = require('../../utils/util')

Page({
  data: {
    categories: [],
    currentCategory: '全部',
    articles: [],
    filteredList: [],
    favIds: [],
    showFavoritesOnly: false
  },

  onLoad: function() {
    this.loadArticles()
  },

  onShow: function() {
    this.loadArticles()
  },

  loadArticles: function() {
    var all = wx.getStorageSync('articles') || []
    var list = all.length > 0 ? all : this.getMockArticles()
    list = list.filter(function(item) { return !item.status || item.status === '已发布' })

    var favs = wx.getStorageSync('favorites') || []
    // 从真实文章数据中提取分类并计数
    var catMap = {}
    list.forEach(function(item) {
      var cat = item.category || '未分类'
      catMap[cat] = (catMap[cat] || 0) + 1
    })
    var catEntries = []
    var totalCount = 0
    for (var cat in catMap) {
      if (catMap.hasOwnProperty(cat)) {
        catEntries.push({ name: cat, count: catMap[cat] })
        totalCount += catMap[cat]
      }
    }
    catEntries.sort(function(a, b) { return b.count - a.count })
    var categories = [{ name: '全部', count: totalCount }].concat(catEntries)

    // 如果之前选中分类在当前列表中不存在，重置为全部
    var curCat = this.data.currentCategory
    var catExists = categories.some(function(c) { return c.name === curCat })
    if (!catExists) curCat = '全部'

    this.setData({ articles: list, categories: categories, favIds: favs, currentCategory: curCat })
    this.updateFilteredList()
  },

  getMockArticles: function() {
    return getApp().getArticles()
  },

  updateFilteredList: function() {
    var articles = this.data.articles
    var curCat = this.data.currentCategory
    var favIds = this.data.favIds
    var filtered
    if (curCat === '全部') {
      filtered = articles
    } else {
      filtered = articles.filter(function(item) { return item.category === curCat })
    }

    // 标记收藏状态
    filtered = filtered.map(function(item) {
      var isFav = favIds.indexOf(item.id) >= 0
      return Object.assign({}, item, { isFav: isFav })
    })

    // 如果启用了"仅看收藏"，再过滤一次
    if (this.data.showFavoritesOnly) {
      filtered = filtered.filter(function(item) { return item.isFav })
    }

    this.setData({ filteredList: filtered })
  },

  onCategoryChange: function(e) {
    var cat = e.currentTarget.dataset.category
    this.setData({ currentCategory: cat, showFavoritesOnly: false })
    this.updateFilteredList()
  },

  onToggleFav: function(e) {
    var id = e.currentTarget.dataset.id
    var favs = wx.getStorageSync('favorites') || []
    var idx = favs.indexOf(id)
    if (idx >= 0) {
      favs.splice(idx, 1)
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      favs.push(id)
      wx.showToast({ title: '已收藏', icon: 'none' })
    }
    wx.setStorageSync('favorites', favs)
    this.setData({ favIds: favs })
    this.updateFilteredList()
  },

  onToggleFavoritesOnly: function() {
    var newVal = !this.data.showFavoritesOnly
    this.setData({ showFavoritesOnly: newVal })
    this.updateFilteredList()
  },

  onArticleTap: function(e) {
    var id = e.currentTarget.dataset.id
    util.navigateTo('/pages/article/detail?id=' + id)
  },

  onPullDownRefresh: function() {
    this.loadArticles()
    wx.stopPullDownRefresh()
  }
})
