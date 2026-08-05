// pages/mine/mine.js
const util = require("../../utils/util")
const auth = require("../../utils/auth")

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    showEditPopup: false,editStudentId: "",editNickName: "",
    editGrade: "",
    editMajor: "",
    editClassName: "",
    grades: ["大一", "大二", "大三", "大四", "研一", "研二", "研三", "博士"],
    menuItems: [
      { icon: "edit", title: "测评记录与趋势", path: "/pages/assessment/history?id=1", color: "#8fc8b5" },
      { icon: "star", title: "收藏文章", path: "/pages/article/list", color: "#f5d79e" },
      { icon: "smile-o", title: "16型人格探索", path: "/pages/personality/index", color: "#f7b7a0" },
      { icon: "phone-o", title: "求助与支持", path: "/pages/help/index", color: "#8fc1e0" },
      { icon: "shield-o", title: "隐私与授权", path: "/pages/privacy/index", color: "#b8a9d4" },
      { icon: "info-o", title: "关于我们", path: "", color: "#b0b0b0", isModal: true }
    ]
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.checkLoginStatus()
  },

  checkLoginStatus() {
    const userInfo = auth.getCurrentUser()
    if (userInfo && userInfo.role !== "student") {
      auth.routeToRoleHome(userInfo)
      return
    }
    if (userInfo) {
      this.setData({ isLoggedIn: true, userInfo })
    } else {
      this.setData({ isLoggedIn: false, userInfo: null })
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" })
  },

  onEditProfile() {
    const info = this.data.userInfo || {}
    this.setData({
      showEditPopup: true,
      editNickName: info.nickName || "",editStudentId: info.studentId || "",
      editGrade: info.grade || "",
      editMajor: info.major || "",
      editClassName: info.className || ""
    })
  },

  onCloseEditPopup() {
    this.setData({ showEditPopup: false })
  },

  onNickNameInput(e) { this.setData({ editNickName: e.detail }) },
  onMajorInput(e) { this.setData({ editMajor: e.detail }) },
  onClassNameInput(e) { this.setData({ editClassName: e.detail }) },

  onStudentIdInput(e) { this.setData({ editStudentId: e.detail }) },

  onGradeSelect(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({ editGrade: this.data.grades[idx] })
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    const userInfo = this.data.userInfo || {}
    userInfo.avatarUrl = avatarUrl
    wx.setStorageSync("userInfo", userInfo)
    this.setData({ userInfo })
  },

  onSaveProfile() {
    const userInfo = this.data.userInfo || {}
    userInfo.nickName = this.data.editNickName || userInfo.nickName || "同学"
    userInfo.grade = this.data.editGrade || userInfo.grade || ""
    userInfo.major = this.data.editMajor || userInfo.major || ""
    userInfo.className = this.data.editClassName || userInfo.className || ""
    wx.setStorageSync("userInfo", userInfo)
    this.setData({ userInfo, showEditPopup: false })
    wx.showToast({ title: "保存成功", icon: "success" })
  },

  onMenuTap(e) {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" })
      return
    }
    const { path, isModal } = e.currentTarget.dataset
    if (isModal) {
      wx.showModal({
        title: "关于我们",
        content: "数智心港湾 v2.0.0（演示原型）\n\n面向学生、辅导员和管理员的心理健康教育、状态筛查与支持平台。测评结果不构成医疗诊断。",
        showCancel: false
      })
      return
    }
    if (path) wx.navigateTo({ url: path })
  },

  onLogout() {
    wx.showModal({
      title: "提示",
      content: "确定要退出登录吗？",
      success: (res) => {
        if (res.confirm) {
          auth.clearSession("学生主动退出")
          this.setData({ isLoggedIn: false, userInfo: null })
          wx.showToast({ title: "已退出登录", icon: "none" })
          setTimeout(() => wx.reLaunch({ url: "/pages/login/login" }), 300)
        }
      }
    })
  }
})
