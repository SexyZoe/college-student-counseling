const auth = require('../../utils/auth')
const semesterService = require('../../utils/semester')
Page({
  data: { tabs: ["学期", "学生", "分配", "导入"], activeTab: "学期", semesters: [], currentSemester: null, students: [], importJobs: [], semesterName: "", startDate: "", endDate: "" },
  onShow() { if (!auth.requireRole('admin')) return; this.loadData() },
  loadData() { this.setData({ semesters: semesterService.getSemesters(), currentSemester: semesterService.getCurrentSemester(), students: wx.getStorageSync("classStudents") || [], importJobs: wx.getStorageSync("importJobs") || [] }) },
  onTab(e) { this.setData({ activeTab: e.currentTarget.dataset.tab }) },
  onSemesterName(e) { this.setData({ semesterName: e.detail.value }) }, onStart(e) { this.setData({ startDate: e.detail.value }) }, onEnd(e) { this.setData({ endDate: e.detail.value }) },
  createSemester() {
    const result = semesterService.createSemester({ name: this.data.semesterName, startDate: this.data.startDate, endDate: this.data.endDate })
    if (!result.ok) return wx.showToast({ title: result.message, icon: "none" })
    this.setData({ semesterName: "", startDate: "", endDate: "" })
    this.loadData()
    wx.showToast({ title: "学期已创建", icon: "success" })
  },
  setCurrent(e) {
    const id = e.currentTarget.dataset.id
    const target = this.data.semesters.find(item => item.id === id)
    if (!target) return wx.showToast({ title: "未找到该学期", icon: "none" })
    wx.showModal({
      title: "切换当前学期",
      content: "切换为“" + target.name + "”后，已有任务和测评结果仍保留原学期归属。",
      success: res => {
        if (!res.confirm) return
        const result = semesterService.setCurrentSemester(id)
        if (!result.ok) return wx.showToast({ title: result.message, icon: "none" })
        this.loadData()
        wx.showToast({ title: "切换成功", icon: "success" })
      }
    })
  },
  chooseImport() {
    wx.chooseMessageFile({ count:1, type:"file", extension:["csv","xlsx"], success: res => { const file = res.tempFiles[0]; const jobs = wx.getStorageSync("importJobs") || []; jobs.unshift({ id:Date.now(), fileName:file.name, size:file.size, status:"待校验", createdAt:new Date().toLocaleString() }); wx.setStorageSync("importJobs",jobs); this.loadData(); this.log("选择导入文件 " + file.name); wx.showToast({ title:"文件已选择，待后端校验", icon:"none" }) } })
  },
  log(action) { const logs = wx.getStorageSync("auditLogs") || []; logs.push({ id:Date.now(), operator:"系统管理员", action, time:new Date().toLocaleString() }); wx.setStorageSync("auditLogs",logs) }
})
