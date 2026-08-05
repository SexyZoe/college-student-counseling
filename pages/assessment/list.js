// pages/assessment/list.js
const util = require('../../utils/util')
const auth = require('../../utils/auth')

Page({
  data: {
    categories: ['全部'],
    currentCategory: '全部',
    assessmentList: [],
    filteredList: []
  },

  onLoad() {
    this.loadAssessments()
  },

  onShow() {
    if (!auth.requireRole('student')) return
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 1 })
  },

  loadAssessments() {
    const assessments = wx.getStorageSync('assessments') || []
    // 如果没有数据，使用模拟数据
    const list = assessments.length > 0 ? assessments : this.getMockAssessments()
    const categories = ['全部'].concat(Array.from(new Set(list.map(item => item.category))))
    this.setData({ assessmentList: list, categories })
    this.updateFilteredList()
  },

  getMockAssessments() {
    return getApp().getAssessments()
  },

  updateFilteredList() {
    const { assessmentList, currentCategory } = this.data
    const filteredList = currentCategory === '全部'
      ? assessmentList
      : assessmentList.filter(item => item.category === currentCategory)
    this.setData({ filteredList })
  },

  onCategoryChange(e) {
    this.setData({ currentCategory: e.currentTarget.dataset.category })
    this.updateFilteredList()
  },

  onAssessmentTap(e) {
    const id = e.currentTarget.dataset.id
    util.navigateTo(`/pages/assessment/detail?id=${id}`)
  },

  onPullDownRefresh() {
    this.loadAssessments()
    wx.stopPullDownRefresh()
  }
})
