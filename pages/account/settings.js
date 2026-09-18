const apiClient = require("../../utils/api-client")
const auth = require("../../utils/auth")

Page({
  data:{ user:null, displayName:"", consent:false, currentPassword:"", newPassword:"", confirmPassword:"", loading:false, error:"" },
  onLoad() {
    if (!apiClient.getSettings().enabled || !apiClient.getSession()) {
      this.setData({ error:"请先使用云端账号登录" })
      return
    }
    this.setData({ loading:true })
    return apiClient.getAccount().then(user => {
      this.setData({ user, displayName:user.displayName || "", loading:false })
    }).catch(error => this.setData({ loading:false, error:error.message }))
  },
  onInput(event) {
    const field = event.currentTarget.dataset.field
    if (["displayName", "currentPassword", "newPassword", "confirmPassword"].includes(field)) {
      this.setData({ [field]:event.detail.value, error:"" })
    }
  },
  onConsent(event) { this.setData({ consent:event.detail.value.includes("agree"), error:"" }) },
  viewPolicy() { wx.navigateTo({ url:"/pages/privacy/index" }) },
  async save() {
    if (this.data.loading || !this.data.user) return
    const user = this.data.user
    const displayName = this.data.displayName.trim()
    const updateProfile = user.role === "student" && (!user.profileCompleted || displayName !== user.displayName)
    const changePassword = user.mustChangePassword || !!this.data.newPassword || !!this.data.confirmPassword
    if (updateProfile && (!displayName || !this.data.consent)) {
      this.setData({ error:"请填写姓名，并阅读同意下方信息使用说明" }); return
    }
    if (changePassword && (!this.data.currentPassword || this.data.newPassword.length < 8 || this.data.newPassword.length > 64)) {
      this.setData({ error:"请填写原密码和8至64位新密码" }); return
    }
    if (changePassword && this.data.newPassword !== this.data.confirmPassword) {
      this.setData({ error:"两次输入的新密码不一致" }); return
    }
    if (!updateProfile && !changePassword) { this.setData({ error:"没有需要保存的修改" }); return }
    this.setData({ loading:true, error:"" })
    try {
      let updated = user
      if (updateProfile) {
        updated = await apiClient.updateStudentProfile({ displayName, consent:true })
        this.setData({ user:updated })
        const remote = apiClient.getSession()
        wx.setStorageSync("backendSession", Object.assign({}, remote, { user:updated }))
      }
      if (changePassword) {
        await apiClient.changePassword({ currentPassword:this.data.currentPassword, newPassword:this.data.newPassword })
        auth.clearSession("密码已修改，请重新登录")
        this.setData({ currentPassword:"", newPassword:"", confirmPassword:"", loading:false })
        wx.showToast({ title:"密码已修改，请登录", icon:"none" })
        wx.reLaunch({ url:"/pages/login/login" })
        return
      }
      const previous = wx.getStorageSync("userInfo") || {}
      auth.createSession(Object.assign({}, previous, updated, { studentName:updated.displayName, nickName:updated.displayName }))
      this.setData({ loading:false })
      wx.showToast({ title:"资料已保存", icon:"success" })
      auth.routeToRoleHome(updated)
    } catch (error) { this.setData({ loading:false, error:error.message || "保存失败，请重试" }) }
  },
  backToLogin() {
    auth.logout("返回登录").finally(() => wx.reLaunch({ url:"/pages/login/login" }))
  }
})
