Page({
  data: {
    step: "login",
    role: "student",
    roleOptions: [
      { value: "student", label: "学生", accountLabel: "学号" },
      { value: "counselor", label: "辅导员", accountLabel: "工号" },
      { value: "admin", label: "管理员", accountLabel: "账号" }
    ],
    accountLabel: "学号",
    accountId: "",
    password: "",
    agreed: false,
    loading: false,
    loginError: ""
  },

  onRoleTap(e) {
    const role = e.currentTarget.dataset.role
    const selected = this.data.roleOptions.find(item => item.value === role)
    this.setData({ role, accountLabel: selected.accountLabel, accountId: "", password: "", loginError: "" })
  },
  onAccountInput(e) { this.setData({ accountId: e.detail, loginError: "" }) },
  onPasswordInput(e) { this.setData({ password: e.detail, loginError: "" }) },
  onAgreementChange(e) { this.setData({ agreed: e.detail }) },

  viewAgreement() {
    wx.navigateTo({ url: "/pages/privacy/index" })
  },

  onLogin() {
    const accountId = this.data.accountId.trim()
    if (!accountId) return this.setData({ loginError: "请输入" + this.data.accountLabel })
    if (!this.data.password.trim()) return this.setData({ loginError: "请输入密码" })
    if (!this.data.agreed) return wx.showToast({ title: "请先阅读并同意隐私政策", icon: "none" })

    const account = this.getMockAccount(this.data.role, accountId, this.data.password.trim())
    if (!account) return this.setData({ loginError: "账号或密码错误，请使用页面下方的演示账号" })

    this.setData({ loading: true, loginError: "" })
    setTimeout(() => {
      wx.setStorageSync("pendingAccount", account)
      if (account.role === "student") this.setData({ loading: false, step: "bind" })
      else this.finishLogin(account)
    }, 350)
  },

  onBindWechat() {
    this.setData({ loading: true })
    wx.getUserProfile({
      desc: "用于绑定微信身份与校内账号",
      success: res => this.finishStudentLogin(res.userInfo),
      fail: () => this.finishStudentLogin(null)
    })
  },

  onSkipBind() { this.finishStudentLogin(null) },

  finishStudentLogin(wechatInfo) {
    const account = wx.getStorageSync("pendingAccount") || {}
    account.nickName = wechatInfo ? wechatInfo.nickName : account.studentName
    account.avatarUrl = wechatInfo ? wechatInfo.avatarUrl : "/images/articles/article_growth.png"
    account.wechatBound = !!wechatInfo
    this.finishLogin(account)
  },

  finishLogin(account) {
    wx.setStorageSync("userInfo", account)
    wx.removeStorageSync("pendingAccount")
    getApp().globalData.userInfo = account
    getApp().globalData.isLoggedIn = true
    getApp().globalData.role = account.role
    this.setData({ loading: false, step: "done" })
    wx.showToast({ title: "登录成功", icon: "success" })
    setTimeout(() => {
      if (account.role === "counselor") wx.reLaunch({ url: "/pages/counselor/dashboard" })
      else if (account.role === "admin") wx.reLaunch({ url: "/pages/admin/dashboard" })
      else wx.switchTab({ url: "/pages/index/index" })
    }, 500)
  },

  goBack() { this.setData({ step: "login", loading: false }) },

  getMockAccount(role, accountId, password) {
    if (password !== "123456") return null
    const accounts = [
      { role: "student", accountId: "2024001", studentId: "2024001", studentName: "张同学", nickName: "张同学", grade: "大二", major: "计算机科学与技术", className: "计科2401", counselor: "王辅导员", counselorPhone: "010-12345678" },
      { role: "student", accountId: "2024002", studentId: "2024002", studentName: "李同学", nickName: "李同学", grade: "大二", major: "计算机科学与技术", className: "计科2401", counselor: "王辅导员", counselorPhone: "010-12345678" },
      { role: "counselor", accountId: "T001", staffId: "T001", name: "王辅导员", nickName: "王老师", department: "计算机学院", classIds: ["CS2401", "AI2401"], avatarUrl: "/images/avatars/avatar_1.png" },
      { role: "admin", accountId: "admin", staffId: "A001", name: "系统管理员", nickName: "系统管理员", department: "学生工作部", avatarUrl: "/images/avatars/avatar_2.png" }
    ]
    return accounts.find(item => item.role === role && item.accountId.toLowerCase() === accountId.toLowerCase()) || null
  }
})
