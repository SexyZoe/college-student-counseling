Page({
  data: {
    resources: [
      { name: "医疗急救", time: "24小时", phone: "120", note: "发生危及生命的紧急情况时拨打" },
      { name: "公安报警", time: "24小时", phone: "110", note: "存在暴力、失联或其他紧急危险时拨打" }
    ]
  },
  callResource(e) {
    wx.showModal({
      title: "确认拨打",
      content: "将拨打 " + e.currentTarget.dataset.name + "：" + e.currentTarget.dataset.phone,
      success: res => { if (res.confirm) wx.makePhoneCall({ phoneNumber: e.currentTarget.dataset.phone }) }
    })
  }
})
