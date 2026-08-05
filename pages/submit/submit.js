// pages/submit/submit.js
const util = require('../../utils/util')
Page({
  data: { title: '', category: '压力管理', content: '', categories: ['压力管理','情绪调节','睡眠健康','学业适应','人际关系','自我成长','恋爱与情感','就业规划','求助指南'] },
  onTitleInput(e) { this.setData({ title: e.detail }) },
  onContentInput(e) { this.setData({ content: e.detail }) },
  onCategoryChange(e) { this.setData({ category: this.data.categories[e.detail.value] }) },
  onSubmit() {
    if (!this.data.title.trim()) { util.showToast('请输入标题'); return }
    if (!this.data.content.trim()) { util.showToast('请输入内容'); return }
    const articles = wx.getStorageSync('articles') || []
    const user = wx.getStorageSync('userInfo') || {}
    articles.unshift({ id: Date.now(), title: this.data.title, cover: '/images/articles/article_growth.png', summary: this.data.content.substring(0, 50) + '...', content: this.data.content, views: 0, category: this.data.category, author: user.nickName || '学生投稿', reviewer: '待管理员审核', createTime: util.formatDate(new Date()), updateTime: util.formatDate(new Date()), status: '待审核' })
    wx.setStorageSync('articles', articles)
    util.showToast('已提交审核')
    setTimeout(() => wx.navigateBack(), 1500)
  }
})
