// pages/article/list.js
const util = require('../../utils/util')

Page({
  data: {
    categories: ['全部', '我的收藏'],
    currentCategory: '全部',
    articles: [],
    filteredList: []
  },

  onLoad() {
    this.loadArticles()
  },

  loadArticles() {
    const articles = wx.getStorageSync('articles') || []
    // 如果没有数据，使用模拟数据
    const list = (articles.length > 0 ? articles : this.getMockArticles()).filter(item => !item.status || item.status === '已发布')
    const categories = ['全部'].concat(Array.from(new Set(list.map(item => item.category)))).concat(['我的收藏'])
    this.setData({ articles: list, categories })
    this.updateFilteredList()
  },

  getMockArticles() {
    return getApp().getArticles()
  },

  updateFilteredList() {
    const { articles, currentCategory } = this.data
    let filteredList;
    if (currentCategory === '全部') filteredList = articles;
    else if (currentCategory === '我的收藏') {
      const favs = wx.getStorageSync('favorites') || [];
      filteredList = articles.filter(item => favs.includes(item.id));
    } else filteredList = articles.filter(item => item.category === currentCategory)
    this.setData({ filteredList })
  },

  onCategoryChange(e) {
    this.setData({ currentCategory: e.currentTarget.dataset.category })
    this.updateFilteredList()
  },

  onArticleTap(e) {
    const id = e.currentTarget.dataset.id
    util.navigateTo(`/pages/article/detail?id=${id}`)
  },

  onPullDownRefresh() {
    this.loadArticles()
    wx.stopPullDownRefresh()
  }
})
