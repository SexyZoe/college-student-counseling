const auth = require("../../utils/auth")
const apiClient = require("../../utils/api-client")
const resultSync = require("../../utils/result-sync")

function eventValue(event) {
  if (!event || !event.detail) return ""
  return typeof event.detail === "object" && event.detail.value !== undefined
    ? event.detail.value
    : event.detail
}

Page({
  data: {
    step: "login",
    role: "student",
    roleOptions: auth.getRoleOptions(),
    accountLabel: auth.ROLE_CONFIG.student.accountLabel,
    accountPlaceholder: auth.ROLE_CONFIG.student.accountPlaceholder,
    roleDescription: auth.ROLE_CONFIG.student.description,
    accountId: "",
    password: "",
    showPassword: false,
    agreed: false,
    loading: false,
    loginError: "",
    bindError: "",
    verifiedAccount: null,
    bindAvatarUrl: "/images/articles/article_growth.png",
    bindNickName: ""
  },

  onLoad() {
    const user = auth.getCurrentUser()
    if (user) auth.routeToRoleHome(user)
  },

  onRoleTap(event) {
    if (this.data.loading) return
    const role = event.currentTarget.dataset.role
    const selected = auth.ROLE_CONFIG[role]
    if (!selected) return
    this.setData({
      role,
      accountLabel: selected.accountLabel,
      accountPlaceholder: selected.accountPlaceholder,
      roleDescription: selected.description,
      accountId: "",
      password: "",
      loginError: ""
    })
  },

  onAccountInput(event) {
    this.setData({ accountId: eventValue(event), loginError: "" })
  },

  onPasswordInput(event) {
    this.setData({ password: eventValue(event), loginError: "" })
  },

  onAgreementChange(event) {
    this.setData({ agreed: !!event.detail, loginError: "" })
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  viewAgreement() {
    wx.navigateTo({ url: "/pages/privacy/index" })
  },

  onLogin() {
    if (this.data.loading) return
    if (!this.data.agreed) {
      this.setData({ loginError: "请先阅读并同意隐私政策与敏感信息说明" })
      return
    }

    this.setData({ loading: true, loginError: "" })
    const result = auth.authenticate({
      role: this.data.role,
      accountId: this.data.accountId,
      password: this.data.password
    })

    if (!result.ok) {
      this.setData({ loading: false, loginError: result.message })
      return
    }

    const account = result.account
    if (account.role === "student") {
      this.setData({
        loading: false,
        step: "bind",
        verifiedAccount: account,
        bindError: "",
        bindAvatarUrl: "/images/articles/article_growth.png",
        bindNickName: ""
      })
      return
    }
    this.finishLogin(account)
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl
    if (avatarUrl) this.setData({ bindAvatarUrl: avatarUrl, bindError: "" })
  },

  onNickNameInput(event) {
    this.setData({ bindNickName: event.detail.value, bindError: "" })
  },

  confirmWechatBind() {
    if (this.data.loading) return
    const nickName = String(this.data.bindNickName || "").trim()
    if (!nickName) {
      this.setData({ bindError: "请填写或选择微信昵称" })
      return
    }
    this.setData({ loading: true, bindError: "" })
    this.finishStudentLogin({
      nickName,
      avatarUrl: this.data.bindAvatarUrl || "/images/articles/article_growth.png"
    })
  },

  onSkipBind() {
    if (this.data.loading) return
    this.finishStudentLogin(null)
  },

  finishStudentLogin(wechatInfo) {
    const account = Object.assign({}, this.data.verifiedAccount || {})
    if (!account.accountId) {
      this.setData({ loading: false, step: "login", loginError: "登录信息已失效，请重新验证" })
      return
    }
    account.nickName = wechatInfo ? wechatInfo.nickName : account.studentName
    account.avatarUrl = wechatInfo ? wechatInfo.avatarUrl : "/images/articles/article_growth.png"
    account.wechatBound = !!wechatInfo
    this.finishLogin(account)
  },

  finishLogin(account) {
    try {
      const backendCredentials = { role: account.role, accountId: account.accountId, password: this.data.password }
      auth.createSession(account, { consentAt: new Date().toISOString() })
      if (apiClient.getSettings().enabled) {
        apiClient.login(backendCredentials).then(function() {
          return resultSync.flushPendingResults()
        }).catch(function(error) {
          wx.setStorageSync("backendLastError", { code: error.code || "LOGIN_FAILED", message: error.message, time: Date.now() })
        })
      }
      this.setData({ loading: false, step: "done", password: "", verifiedAccount: null })
      wx.showToast({ title: "登录成功", icon: "success" })
      auth.routeToRoleHome(account, { delay: 500 })
    } catch (error) {
      this.setData({ loading: false, step: "login", loginError: "创建登录会话失败，请重新尝试" })
    }
  },

  goBack() {
    this.setData({
      step: "login",
      loading: false,
      password: "",
      verifiedAccount: null,
      bindAvatarUrl: "/images/articles/article_growth.png",
      bindNickName: "",
      bindError: ""
    })
  }
})
