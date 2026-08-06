const auth = require('../../utils/auth')
Page({
  data: { classId: "", className: "", students: [], filtered: [], filters: ["全部", "未完成", "关注", "较高风险", "紧急风险"], activeFilter: "全部", summary: {}, riskDistribution: [], dimensions: [] },
  onLoad(options) { if (!auth.requireRole('counselor')) return; this.setData({ classId: options.id || "CS2401" }); this.loadData() },
  loadData() {
    const students = (wx.getStorageSync("classStudents") || []).filter(item => item.classId === this.data.classId)
    const completed = students.filter(item => item.completion === "已完成").length
    const scored = students.filter(item => item.latestScore > 0)
    const count = level => students.filter(item => item.riskLevel === level).length
    const average = scored.length ? Math.round(scored.reduce((sum,item) => sum + item.latestScore, 0) / scored.length) : 0
    this.setData({
      students, filtered: students, className: students[0] ? students[0].className : "班级",
      summary: { total: students.length, completed, rate: students.length ? Math.round(completed / students.length * 100) : 0, average },
      riskDistribution: [{ label:"正常", value:count("正常"), color:"#8fc8b5" }, { label:"关注", value:count("关注"), color:"#f5d79e" }, { label:"较高风险", value:count("较高风险"), color:"#f4a3a8" }, { label:"紧急风险", value:count("紧急风险"), color:"#d96b72" }, { label:"未评估", value:count("未评估"), color:"#c8c8c8" }],
      dimensions: [{label:"情绪状态",value:Math.min(100,average+8)}, {label:"压力负荷",value:Math.max(0,average-5)}, {label:"睡眠精力",value:Math.max(0,average-10)}, {label:"人际适应",value:Math.min(100,average+12)}, {label:"学业适应",value:average}]
    })
  },
  onFilter(e) { const activeFilter = e.currentTarget.dataset.filter; let filtered = this.data.students; if (activeFilter === "未完成") filtered = filtered.filter(item => item.completion === "未完成"); else if (activeFilter !== "全部") filtered = filtered.filter(item => item.riskLevel === activeFilter); this.setData({ activeFilter, filtered }) },
  goStudent(e) { wx.navigateTo({ url: "/pages/counselor/student-detail?id=" + e.currentTarget.dataset.id }) }
})
