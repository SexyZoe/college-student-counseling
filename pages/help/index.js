Page({
  data: {
    resources: [
      { name: "学校心理健康教育中心", time: "工作日 8:30-17:30", phone: "010-12345678", note: "预约咨询、心理支持与转介" },
      { name: "学校保卫部门", time: "24小时", phone: "010-87654321", note: "校园内存在即时人身安全风险时联系" },
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
