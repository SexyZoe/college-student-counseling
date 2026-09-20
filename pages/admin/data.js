const auth = require('../../utils/auth')
const apiClient = require('../../utils/api-client')
const semesterService = require('../../utils/semester')

Page({
  data: {
    tabs: ["学期", "学生", "分配", "导入"],
    activeTab: "学期",
    semesters: [],
    currentSemester: null,
    students: [],
    assignments: [],
    assignmentClasses: [],
    assignmentClassIndex: 0,
    assignmentStaffId: "",
    importJobs: [],
    selectedBatch: null,
    semesterName: "",
    startDate: "",
    endDate: "",
    backendEnabled: false,
    backendReady: false,
    loading: false
  },

  onShow() {
    if (!auth.requireRole('admin')) return
    this.loadData()
  },

  loadData() {
    const enabled = apiClient.getSettings().enabled
    const ready = enabled && !!apiClient.getSession()
    this.setData({
      backendEnabled: enabled,
      backendReady: ready,
      semesters: semesterService.getSemesters(),
      currentSemester: semesterService.getCurrentSemester(),
      students: wx.getStorageSync("classStudents") || [],
      assignments: [],
      importJobs: wx.getStorageSync("importJobs") || []
    })
    if (ready) this.loadRemoteData()
  },

  loadRemoteData() {
    this.setData({ loading:true })
    Promise.all([
      apiClient.getAdminSemesters(),
      apiClient.getAdminStudents(),
      apiClient.getAdminAssignments(),
      apiClient.getImportBatches()
    ]).then(results => {
      const semesters = results[0]
      this.setData({
        semesters:semesters,
        currentSemester:semesters.find(item => item.status === "当前学期") || null,
        students:results[1],
        assignmentClasses:Array.from(new Map(results[1].filter(item => item.active && item.classId).map(item => [item.classId, { id:item.classId, name:item.className || item.classId }])).values()),
        assignments:results[2],
        importJobs:results[3],
        loading:false
      })
    }).catch(error => this.handleBackendError(error))
  },

  onTab(e) { this.setData({ activeTab:e.currentTarget.dataset.tab, selectedBatch:null }) },
  onSemesterName(e) { this.setData({ semesterName:e.detail.value }) },
  onStart(e) { this.setData({ startDate:e.detail.value }) },
  onEnd(e) { this.setData({ endDate:e.detail.value }) },
  onAssignmentStaff(e) { this.setData({ assignmentStaffId:e.detail.value }) },
  onAssignmentClass(e) { this.setData({ assignmentClassIndex:Number(e.detail.value) }) },
  assignCounselor() {
    if (this.data.loading || !this.requireBackend()) return
    const classroom = this.data.assignmentClasses[this.data.assignmentClassIndex]
    if (!classroom || !this.data.currentSemester || !this.data.assignmentStaffId.trim()) {
      wx.showToast({ title:"请选择班级、填写工号并设置当前学期", icon:"none" }); return
    }
    this.setData({ loading:true })
    apiClient.createCounselorAssignment({ classId:classroom.id, semesterId:this.data.currentSemester.id, staffId:this.data.assignmentStaffId.trim().toUpperCase() }).then(() => {
      this.setData({ assignmentStaffId:"" })
      this.loadRemoteData()
      wx.showToast({ title:"班级已分配", icon:"success" })
    }).catch(error => this.handleBackendError(error))
  },

  createSemester() {
    const input = { name:this.data.semesterName, startDate:this.data.startDate, endDate:this.data.endDate }
    if (this.data.backendEnabled && !this.data.backendReady) return this.requireBackend()
    if (this.data.backendReady) {
      this.setData({ loading:true })
      apiClient.createAdminSemester(input).then(() => {
        this.setData({ semesterName:"", startDate:"", endDate:"", loading:false })
        this.loadRemoteData()
        wx.showToast({ title:"学期已创建", icon:"success" })
      }).catch(error => this.handleBackendError(error))
      return
    }
    const result = semesterService.createSemester(input)
    if (!result.ok) return wx.showToast({ title:result.message, icon:"none" })
    this.setData({ semesterName:"", startDate:"", endDate:"" })
    this.loadData()
    wx.showToast({ title:"学期已创建", icon:"success" })
  },

  setCurrent(e) {
    const id = e.currentTarget.dataset.id
    const target = this.data.semesters.find(item => item.id === id)
    if (!target) return wx.showToast({ title:"未找到该学期", icon:"none" })
    wx.showModal({
      title:"切换当前学期",
      content:"切换为“" + target.name + "”后，已有任务和测评结果仍保留原学期归属。",
      success:res => {
        if (!res.confirm) return
        if (this.data.backendEnabled && !this.data.backendReady) return this.requireBackend()
        if (this.data.backendReady) {
          this.setData({ loading:true })
          apiClient.setAdminCurrentSemester(id).then(() => {
            this.setData({ loading:false })
            this.loadRemoteData()
            wx.showToast({ title:"切换成功", icon:"success" })
          }).catch(error => this.handleBackendError(error))
          return
        }
        const result = semesterService.setCurrentSemester(id)
        if (!result.ok) return wx.showToast({ title:result.message, icon:"none" })
        this.loadData()
        wx.showToast({ title:"切换成功", icon:"success" })
      }
    })
  },

  copyTemplate() {
    const template = [
      "班级,学号,手机号",
      "软件工程1班,20260001,13812345678",
      "软件工程1班,20260002,13912345678"
    ].join("\n")
    wx.setClipboardData({ data:template, success:() => wx.showToast({ title:"CSV模板已复制", icon:"success" }) })
  },

  chooseImport() {
    if (!this.requireBackend()) return
    wx.chooseMessageFile({
      count:1,
      type:"file",
      extension:["csv"],
      success:res => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        if (file.size > 512 * 1024) return wx.showToast({ title:"CSV不能超过512KB", icon:"none" })
        wx.getFileSystemManager().readFile({
          filePath:file.path,
          encoding:"utf8",
          success:content => this.previewImport(file.name, content.data),
          fail:() => wx.showToast({ title:"读取CSV失败", icon:"none" })
        })
      }
    })
  },

  previewImport(fileName, csvText) {
    this.setData({ loading:true, selectedBatch:null })
    const clientBatchId = "client:import:" + Date.now() + ":" + Math.random().toString(36).slice(2, 10)
    apiClient.previewPersonnelImport({ format:"student-roster", clientBatchId:clientBatchId, fileName:fileName, csvText:csvText }).then(batch => {
      this.setData({ loading:false, selectedBatch:batch })
      this.loadRemoteData()
      wx.showModal({
        title:batch.errorCount ? "预检发现问题" : "预检完成",
        content:batch.errorCount
          ? "共 " + batch.totalRows + " 行，发现 " + batch.errorCount + " 项错误。请查看错误后修正文件并重新导入。"
          : "新增 " + batch.createCount + " 项，更新 " + batch.updateCount + " 项，无变化 " + batch.unchangedCount + " 项。确认前不会写入正式数据。",
        showCancel:false
      })
    }).catch(error => this.handleBackendError(error))
  },

  showBatch(e) {
    if (!this.requireBackend()) return
    const id = e.currentTarget.dataset.id
    this.setData({ loading:true })
    apiClient.getImportBatch(id).then(batch => this.setData({ selectedBatch:batch, loading:false })).catch(error => this.handleBackendError(error))
  },

  closeBatch() { this.setData({ selectedBatch:null }) },

  confirmImport(e) {
    if (!this.requireBackend()) return
    const id = e.currentTarget.dataset.id
    const batch = this.data.importJobs.find(item => String(item.id) === String(id)) || this.data.selectedBatch
    if (!batch) return wx.showToast({ title:"未找到导入批次", icon:"none" })
    wx.showModal({
      title:"确认写入人员数据",
      content:"将新增 " + (batch.createCount || 0) + " 项、更新 " + (batch.updateCount || 0) + " 项。系统会保存变更快照用于整批回滚。",
      success:res => {
        if (!res.confirm) return
        this.setData({ loading:true })
        apiClient.confirmImportBatch(id).then(result => {
          this.setData({ selectedBatch:result, loading:false })
          this.loadRemoteData()
          wx.showToast({ title:"导入成功", icon:"success" })
        }).catch(error => this.handleBackendError(error))
      }
    })
  },

  rollbackImport(e) {
    if (!this.requireBackend()) return
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title:"整批回滚",
      content:"新建账号和班级将停用，更新的数据将恢复为导入前快照。若数据已被再次修改，系统会拒绝覆盖。确认继续吗？",
      confirmColor:"#c85d68",
      success:res => {
        if (!res.confirm) return
        this.setData({ loading:true })
        apiClient.rollbackImportBatch(id).then(result => {
          this.setData({ selectedBatch:result, loading:false })
          this.loadRemoteData()
          wx.showToast({ title:"批次已回滚", icon:"success" })
        }).catch(error => this.handleBackendError(error))
      }
    })
  },

  requireBackend() {
    if (this.data.backendReady && apiClient.getSession()) return true
    wx.showModal({
      title:"需要启用后端",
      content:"人员导入涉及敏感账号和权限，不能只保存在本机。请按后端说明启用同步并重新登录管理员账号。",
      showCancel:false
    })
    return false
  },

  resetStudentPassword(event) {
    if (this.data.loading || !this.requireBackend()) return
    const studentId = String(event.currentTarget.dataset.id)
    const student = this.data.students.find(item => item.studentId === studentId)
    if (!student || !student.canResetPassword) return
    wx.showModal({
      title:"重置学生密码",
      content:"将学号 " + studentId + " 的密码重置为登记手机号后4位。现有登录将失效，下次登录须修改密码。",
      success:result => {
        if (!result.confirm) return
        this.setData({ loading:true })
        apiClient.resetStudentPassword(studentId).then(() => {
          this.loadRemoteData()
          wx.showToast({ title:"密码已重置", icon:"success" })
        }).catch(error => this.handleBackendError(error))
      }
    })
  },

  handleBackendError(error) {
    this.setData({ loading:false })
    wx.setStorageSync("backendLastError", { code:error.code || "REQUEST_FAILED", message:error.message, time:Date.now() })
    wx.showToast({ title:error.message || "后端请求失败", icon:"none" })
  }
})
