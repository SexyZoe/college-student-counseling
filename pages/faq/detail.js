Page({
  data: { item: null },
  onLoad: function() { this.setData({ item: wx.getStorageSync("currentFaqItem") || {} }); }
});