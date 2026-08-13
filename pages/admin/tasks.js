const auth = require('../../utils/auth')
const semesterService = require('../../utils/semester')
const scoringEngine = require('../../utils/scoring-engine')
const apiClient = require('../../utils/api-client')
Page({
  data: { tasks: [], assessments: [], title: "", assessmentId: 1, deadline: "", target: "全校" },
  onShow() {
    if (!auth.requireRole('admin')) return
    this.setData({ tasks: wx.getStorageSync("assessmentTasks") || [], assessments: wx.getStorageSync("assessments") || [] })
    if (apiClient.getSettings().enabled) {
      apiClient.getAdminAssessmentTasks().then(tasks => {
        this.setData({ tasks:tasks.map(item => Object.assign({}, item, { semester:item.semesterName || item.semesterId, target:item.targetClassName || "全部班级" })) })
      }).catch(error => wx.setStorageSync("backendLastError", { code:error.code, message:error.message, time:Date.now() }))
    }
  },
  onTitle(e) { this.setData({ title:e.detail.value }) }, onDeadline(e) { this.setData({ deadline:e.detail.value }) },
  selectAssessment(e) { this.setData({ assessmentId:parseInt(e.currentTarget.dataset.id) }) },
  createTask() {
    if(!this.data.title.trim() || !this.data.deadline.trim()) return wx.showToast({title:"请填写任务名称和截止日期",icon:"none"})
    const currentSemester = semesterService.getCurrentSemester()
    if (!currentSemester) return wx.showToast({ title:"请先创建并启用当前学期", icon:"none" })
    const assessment = this.data.assessments.find(item => item.id === this.data.assessmentId) || {}
    const rule = scoringEngine.getRule(this.data.assessmentId)
    if (apiClient.getSettings().enabled) {
      apiClient.createAdminAssessmentTask({
        title:this.data.title.trim(), assessmentId:this.data.assessmentId,
        semesterId:currentSemester.id, questionnaireVersion:assessment.questionnaireVersion || rule.questionnaireVersion,
        scoringVersion:rule.scoringVersion, deadline:this.data.deadline.trim(), targetClassId:""
      }).then(() => {
        this.setData({ title:"", deadline:"" })
        wx.showToast({ title:"草稿已保存", icon:"success" })
        this.onShow()
      }).catch(error => wx.showToast({ title:error.message || "保存失败", icon:"none" }))
      return
    }
    const tasks = this.data.tasks.slice()
    tasks.unshift({
      id:Date.now(), assessmentId:this.data.assessmentId, title:this.data.title.trim(),
      semesterId:currentSemester.id, semester:currentSemester.name,
      semesterSnapshot:semesterService.getSemesterSnapshot(currentSemester.id),
      questionnaireVersion:assessment.questionnaireVersion || rule.questionnaireVersion,
      scoringVersion:rule.scoringVersion,
      deadline:this.data.deadline.trim(), status:"草稿", completed:false, target:this.data.target
    })
    wx.setStorageSync("assessmentTasks",tasks)
    this.setData({title:"",deadline:""})
    this.onShow()
  },
  publish(e) {
    const id=e.currentTarget.dataset.id
    if (apiClient.getSettings().enabled) {
      apiClient.transitionAdminAssessmentTask(id, "进行中").then(() => {
        wx.showToast({ title:"发布成功", icon:"success" }); this.onShow()
      }).catch(error => wx.showToast({ title:error.message || "发布失败", icon:"none" }))
      return
    }
    const tasks=this.data.tasks.map(item=>{if(item.id===id)item.status="进行中";return item})
    wx.setStorageSync("assessmentTasks",tasks); this.onShow()
    const logs=wx.getStorageSync("auditLogs")||[]
    logs.push({id:Date.now(),operator:"系统管理员",action:"发布测评任务 "+id,time:new Date().toLocaleString()})
    wx.setStorageSync("auditLogs",logs)
  }
})
