const auth = require('../../utils/auth')
Page({
  data: { tabs: ["学期", "学生", "分配", "导入"], activeTab: "学期", semesters: [], students: [], importJobs: [], semesterName: "", startDate: "", endDate: "" },
  onShow() { if (!auth.requireRole('admin')) return; this.loadData() },
  loadData() { this.setData({ semesters: wx.getStorageSync("semesters") || [], students: wx.getStorageSync("classStudents") || [], importJobs: wx.getStorageSync("importJobs") || [] }) },
  onTab(e) { this.setData({ activeTab: e.currentTarget.dataset.tab }) },
  onSemesterName(e) { this.setData({ semesterName: e.detail.value }) }, onStart(e) { this.setData({ startDate: e.detail.value }) }, onEnd(e) { this.setData({ endDate: e.detail.value }) },
  createSemester() {
    if (!this.data.semesterName.trim()) return wx.showToast({ title: "请输入学期名称", icon: "none" })
    const list = this.data.semesters.slice(); list.unshift({ id: String(Date.now()), name: this.data.semesterName.trim(), status: "未启用", startDate: this.data.startDate, endDate: this.data.endDate }); wx.setStorageSync("semesters", list); this.setData({ semesterName: "", startDate: "", endDate: "" }); this.loadData(); this.log("创建学期 " + list[0].name)
  },
  setCurrent(e) { let list = this.data.semesters.map(item => { item.status = item.id === e.currentTarget.dataset.id ? "当前学期" : "已归档"; return item }); wx.setStorageSync("semesters", list); this.loadData(); this.log("切换当前学期") },
  chooseImport() {
    wx.chooseMessageFile({ count:1, type:"file", extension:["csv","xlsx"], success: res => { const file = res.tempFiles[0]; const jobs = wx.getStorageSync("importJobs") || []; jobs.unshift({ id:Date.now(), fileName:file.name, size:file.size, status:"待校验", createdAt:new Date().toLocaleString() }); wx.setStorageSync("importJobs",jobs); this.loadData(); this.log("选择导入文件 " + file.name); wx.showToast({ title:"文件已选择，待后端校验", icon:"none" }) } })
  },
  log(action) { const logs = wx.getStorageSync("auditLogs") || []; logs.push({ id:Date.now(), operator:"系统管理员", action, time:new Date().toLocaleString() }); wx.setStorageSync("auditLogs",logs) }
})
