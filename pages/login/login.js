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
    verifiedAccount: null
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
    if (apiClient.getSettings().enabled) {
      return this.loginWithBackend()
    }
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
      this.setData({ loading: false, step: "bind", verifiedAccount: account, bindError: "" })
      return
    }
    this.finishLogin(account)
  },

  loginWithBackend() {
    return apiClient.login({
      role: this.data.role,
      accountId: String(this.data.accountId || "").trim(),
      password: this.data.password
    }).then(result => {
      const user = result.user
      if (!user || !Object.prototype.hasOwnProperty.call(auth.ROLE_CONFIG, user.role) || user.role !== this.data.role || !user.accountId) {
        apiClient.clearSession()
        throw new Error("服务器返回的登录身份无效")
      }
      const account = Object.assign({}, user, {
        nickName: user.displayName,
        name: user.displayName,
        studentName: user.role === "student" ? user.displayName : ""
      })
      wx.removeStorageSync("backendLastError")
      if (user.mustChangePassword || (user.role === "student" && user.profileCompleted === false)) {
        this.setData({ loading:false, password:"", verifiedAccount:null })
        wx.reLaunch({ url:"/pages/account/settings" })
        return
      }
      if (account.role === "student") {
        this.setData({ loading:false, step:"bind", password:"", verifiedAccount:account, bindError:"" })
      } else {
        this.finishLogin(account)
      }
    }).catch(error => {
      auth.clearSession("云端登录失败")
      this.setData({ loading:false, step:"login", loginError:error.message || "云端登录失败，请重试" })
    })
  },

  onBindWechat() {
    if (this.data.loading) return
    this.setData({ loading: true, bindError: "" })
    wx.getUserProfile({
      desc: "用于绑定微信身份与已验证的校内学生账号",
      success: result => this.finishStudentLogin(result.userInfo),
      fail: () => this.setData({
        loading: false,
        bindError: "未获得微信资料授权。你可以重试，或选择暂不绑定进入演示。"
      })
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
      if (apiClient.getSettings().enabled) {
        const remote = apiClient.getSession()
        if (!remote || !remote.token || !Number.isFinite(remote.expiresAt) || remote.expiresAt <= Date.now() || !remote.user || remote.user.accountId !== account.accountId || remote.user.role !== account.role) {
          throw new Error("云端会话失效")
        }
      }
      auth.createSession(account, { consentAt: new Date().toISOString() })
      if (apiClient.getSettings().enabled) {
        resultSync.flushPendingResults().catch(function(error) {
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
    if (apiClient.getSettings().enabled) apiClient.clearSession()
    this.setData({
      step: "login",
      loading: false,
      password: "",
      verifiedAccount: null,
      bindError: ""
    })
  }
})
