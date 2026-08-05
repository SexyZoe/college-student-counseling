// utils/util.js
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatDate = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${formatNumber(month)}-${formatNumber(day)}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// 生成未来7天日期列表
const generateDates = () => {
  const dates = []
  const today = new Date()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
    const month = date.getMonth() + 1
    const day = date.getDate()
    dates.push({
      value: `${month}月${day}日`,
      weekDay: weekDays[date.getDay()],
      full: formatDate(date)
    })
  }
  return dates
}

// 统一页面跳转错误处理
const navigateTo = (url, callback) => {
  wx.navigateTo({
    url,
    fail: () => {
      wx.showToast({ title: '页面跳转失败', icon: 'none' })
      callback && callback()
    }
  })
}

const switchTab = (url, callback) => {
  wx.switchTab({
    url,
    fail: () => {
      wx.showToast({ title: '页面跳转失败', icon: 'none' })
      callback && callback()
    }
  })
}

// 统一提示框
const showToast = (title, icon = 'none') => {
  wx.showToast({ title, icon })
}

const showModal = (title, content, callback) => {
  wx.showModal({
    title,
    content,
    success: (res) => {
      if (res.confirm && callback) {
        callback()
      }
    }
  })
}

module.exports = {
  formatTime,
  formatDate,
  formatNumber,
  generateDates,
  navigateTo,
  switchTab,
  showToast,
  showModal
}