// pages/submit/submit.js
var util = require('../../utils/util')
var DRAFT_KEY = "submitDraft"

Page({
  data: {
    title: '',
    category: '压力管理',
    content: '',
    categories: ['压力管理','情绪调节','睡眠健康','学业适应','人际关系','自我成长','恋爱与情感','就业规划','求助指南'],
    showConfirm: false,
    showSuccess: false,
    showDraftTip: false,
    submissions: []
  },

  onLoad: function() {
    this.restoreDraft()
    this.loadSubmissions()
  },

  onShow: function() {
    this.restoreDraft()
    this.loadSubmissions()
  },

  onHide: function() {
    this.saveDraft()
  },

  onUnload: function() {
    this.saveDraft()
  },

  restoreDraft: function() {
    var draft = wx.getStorageSync(DRAFT_KEY) || {}
    if (draft.title || draft.content || draft.category) {
      this.setData({
        title: draft.title || '',
        category: draft.category || '压力管理',
        content: draft.content || '',
        showDraftTip: true
      })
    }
  },

  saveDraft: function() {
    wx.setStorageSync(DRAFT_KEY, {
      title: this.data.title,
      category: this.data.category,
      content: this.data.content,
      updatedAt: Date.now()
    })
  },

  loadSubmissions: function() {
    var all = wx.getStorageSync('articles') || []
    var mine = all.filter(function(item) {
      return item.id > 1000000000000
    }).sort(function(a, b) {
      return b.id - a.id
    })
    this.setData({ submissions: mine.slice(0, 10) })
  },

  onTitleInput: function(e) {
    this.setData({ title: e.detail.value || e.detail })
  },

  onContentInput: function(e) {
    this.setData({ content: e.detail.value || e.detail })
  },

  onCategoryChange: function(e) {
    var idx = parseInt(e.detail.value)
    var cat = this.data.categories[idx]
    if (cat) this.setData({ category: cat })
  },

  onShowConfirm: function() {
    var title = (this.data.title || '').trim()
    var content = (this.data.content || '').trim()
    if (!title) { wx.showToast({ title: '请输入文章标题', icon: 'none' }); return }
    if (title.length < 2) { wx.showToast({ title: '标题至少2个字符', icon: 'none' }); return }
    if (title.length > 50) { wx.showToast({ title: '标题最多50个字符', icon: 'none' }); return }
    if (!content) { wx.showToast({ title: '请输入文章内容', icon: 'none' }); return }
    if (content.length < 50) { wx.showToast({ title: '内容至少50个字符', icon: 'none' }); return }
    this.setData({ showConfirm: true })
  },

  onCancelConfirm: function() {
    this.setData({ showConfirm: false })
  },

  onSubmit: function() {
    var that = this
    this.setData({ showConfirm: false })
    var articles = wx.getStorageSync('articles') || []
    var user = wx.getStorageSync('userInfo') || {}
    var article = {
      id: Date.now(),
      title: (this.data.title || '').trim(),
      cover: '/images/articles/article_growth.png',
      summary: (this.data.content || '').substring(0, 50) + '...',
      content: (this.data.content || '').trim(),
      views: 0,
      category: this.data.category,
      author: user.nickName || '学生投稿',
      reviewer: '待管理员审核',
      createTime: util.formatDate(new Date()),
      updateTime: util.formatDate(new Date()),
      status: '待审核'
    }
    articles.unshift(article)
    wx.setStorageSync('articles', articles)

    // 清除草稿
    wx.removeStorageSync(DRAFT_KEY)

    this.setData({
      showSuccess: true,
      title: '',
      content: '',
      category: '压力管理',
      showDraftTip: false
    })
    this.loadSubmissions()

    // 延迟跳转
    setTimeout(function() {
      that.setData({ showSuccess: false })
      wx.navigateBack()
    }, 2500)
  },

  onBackToList: function() {
    wx.navigateBack()
  }
})
