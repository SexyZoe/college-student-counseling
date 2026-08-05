Page({
  data: {
    tests: [
      { id: "type16", title: "16 型人格探索", desc: "通过28道自研选择题，了解你的偏好与行为方式", icon: "🧭", color: "#b8a9d4", questions: 28, duration: 8 }
    ]
  },
  onTestTap(e) { wx.navigateTo({ url: "/pages/personality/quiz?id=" + e.currentTarget.dataset.id }) }
})
