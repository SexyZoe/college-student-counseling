function requireRole(role) {
  const user = wx.getStorageSync("userInfo") || {}
  if (user.role !== role) {
    wx.showToast({ title: "请使用对应角色账号登录", icon: "none" })
    setTimeout(() => wx.reLaunch({ url: "/pages/login/login" }), 200)
    return null
  }
  return user
}

module.exports = { requireRole }
