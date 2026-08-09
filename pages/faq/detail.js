Page({
  data: { item: null },
  onLoad: function() { this.setData({ item: wx.getStorageSync("currentFaqItem") || {} 
  onBack: function() { wx.navigateBack(); }
}); }

  onBack: function() { wx.navigateBack(); }
});