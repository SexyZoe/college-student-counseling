const auth = require('../../utils/auth')
const apiClient = require('../../utils/api-client')
Page({
  data: { contentTypes:["成长与价值","心理科普投稿"], activeType:"成长与价值", tabs:["待审核","已发布","已退回"], activeTab:"待审核", items:[], filtered:[] },
  onShow(){ if (!auth.requireRole('admin')) return; this.load() },
  load(){
    const key=this.data.activeType==="成长与价值"?"civicsArticles":"articles"
    const items=wx.getStorageSync(key)||[]
    this.setData({items});this.filter()
    if (apiClient.getSettings().enabled) {
      const type=this.data.activeType==="成长与价值"?"civics":"psychoeducation"
      apiClient.getAdminContent(type, this.data.activeTab).then(remoteItems => {
        this.setData({ items:remoteItems.map(item => Object.assign({}, item, { author:item.authorName, reviewer:item.reviewerName || "待管理员审核" })) })
        this.filter()
      }).catch(error => wx.setStorageSync("backendLastError", { code:error.code, message:error.message, time:Date.now() }))
    }
  },
  onType(e){this.setData({activeType:e.currentTarget.dataset.type,activeTab:"待审核"});this.load()},
  onTab(e){this.setData({activeTab:e.currentTarget.dataset.tab});this.filter()},
  filter(){this.setData({filtered:this.data.items.filter(item=>item.status===this.data.activeTab||(this.data.activeTab==="已发布"&&!item.status))})},
  review(e){
    const id=e.currentTarget.dataset.id,status=e.currentTarget.dataset.status
    if (apiClient.getSettings().enabled) {
      const reviewNote=status==="已退回"?"请根据审核要求修改后重新提交":"内容审核通过"
      apiClient.reviewAdminContent(id,status,reviewNote).then(() => {
        wx.showToast({ title:status==="已发布"?"发布成功":"已退回", icon:"success" });this.load()
      }).catch(error => wx.showToast({ title:error.message || "审核失败", icon:"none" }))
      return
    }
    const user=wx.getStorageSync("userInfo")||{}
    const key=this.data.activeType==="成长与价值"?"civicsArticles":"articles"
    const items=this.data.items.map(item=>{if(item.id===id){item.status=status;item.reviewer=user.name||"系统管理员";item.updateTime=new Date().toISOString().slice(0,10);if(status==="已发布"&&!item.publishTime)item.publishTime=item.updateTime}return item})
    wx.setStorageSync(key,items)
    const logs=wx.getStorageSync("auditLogs")||[]
    logs.push({id:Date.now(),operator:user.name||"系统管理员",action:(status==="已发布"?"审核发布":"退回")+this.data.activeType+"内容 "+id,time:new Date().toLocaleString()})
    wx.setStorageSync("auditLogs",logs)
    this.setData({items});this.filter()
  }
})
