Component({
  data: {
    selected: 0,
    list: [
      { pagePath: "/pages/index/index", text: "首页", icon: "wap-home-o" },
      { pagePath: "/pages/assessment/list", text: "测评", icon: "edit" },
      { pagePath: "/pages/mine/mine", text: "我的", icon: "user-o" }
    ]
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      wx.switchTab({ url: this.data.list[index].pagePath })
      this.setData({ selected: index })
    }
  }
})
