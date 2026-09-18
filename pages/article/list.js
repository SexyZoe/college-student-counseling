// pages/article/list.js
const util = require('../../utils/util')
const apiClient = require('../../utils/api-client')

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
    if (apiClient.getSettings().enabled) {
      apiClient.getPublishedContent("psychoeducation").then(items => {
        const remote = items.map(item => Object.assign({}, item, {
          author:item.authorName, reviewer:item.reviewerName, createTime:item.publishTime || item.createdAt,
          updateTime:item.updatedAt, views:0,
          cover:((item.media || []).find(media => media.kind === "image") || {}).url || "/images/articles/article_growth.png"
        }))
        wx.setStorageSync("articles", remote)
        this.setData({ articles:remote, categories:['全部'].concat(Array.from(new Set(remote.map(item => item.category).filter(Boolean)))).concat(['我的收藏']) })
        this.updateFilteredList()
      }).catch(error => wx.setStorageSync("backendLastError", { code:error.code, message:error.message, time:Date.now() }))
    }
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
