const auth = require("../../utils/auth")

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
      auth.createSession(account, { consentAt: new Date().toISOString() })
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
      bindError: ""
    })
  }
})
