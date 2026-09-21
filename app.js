// app.js
const auth = require("./utils/auth")
const scoringEngine = require("./utils/scoring-engine")
const semesterService = require("./utils/semester")
const resultSync = require("./utils/result-sync")
const apiClient = require("./utils/api-client")

App({
  onLaunch() {
    this.migrateLocalData()
    this.setDefaultStorage("assessments", this.getAssessments())
    if (!apiClient.getSettings().enabled) this.initLocalDemoData()
    semesterService.ensureSemesterState()
    if (apiClient.getSettings().enabled) {
      const remote = apiClient.getSession()
      const local = wx.getStorageSync("userInfo")
      if (!remote || !remote.token || !Number.isFinite(remote.expiresAt) || remote.expiresAt <= Date.now() || !remote.user || !local || remote.user.accountId !== local.accountId || remote.user.role !== local.role) {
        auth.clearSession("请重新登录云端服务")
      }
    }
    auth.restoreSession(this)
    resultSync.flushPendingResults().catch(function() {})
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    role: null,
    selectedTab: 0
  },

  setDefaultStorage(key, value) {
    const keys = wx.getStorageInfoSync().keys || []
    if (keys.indexOf(key) === -1) wx.setStorageSync(key, value)
  },

  migrateLocalData() {
    const schemaVersion = parseInt(wx.getStorageSync("schemaVersion")) || 1
    if (schemaVersion < 2) {
      // V2 移除音乐模块与错误的第9项人格量表；保留已有测评结果和用户收藏。
      wx.removeStorageSync("meditations")
      wx.removeStorageSync("currentMeditation")
      wx.setStorageSync("assessments", this.getAssessments())
      const oldUser = wx.getStorageSync("userInfo")
      if (oldUser && !oldUser.role) {
        oldUser.role = "student"
        wx.setStorageSync("userInfo", oldUser)
      }
      const oldArticles = wx.getStorageSync("articles") || []
      const userSubmissions = oldArticles.filter(item => item.id && item.id > 1000000000000)
      wx.setStorageSync("articles", this.getArticles().concat(userSubmissions))
      wx.setStorageSync("schemaVersion", 2)
    }
    if (schemaVersion < 3) {
      // V3 为问卷、评分规则和学期归属补充稳定版本；历史结果不重新计分。
      const assessments = (wx.getStorageSync("assessments") || []).map(item => Object.assign({}, item, {
        questionnaireVersion: item.questionnaireVersion || scoringEngine.QUESTIONNAIRE_VERSION,
        scoringVersion: item.scoringVersion || scoringEngine.SCORING_VERSION
      }))
      if (assessments.length) wx.setStorageSync("assessments", assessments)
      const semesters = wx.getStorageSync("semesters") || []
      const current = semesters.find(item => item.status === "当前学期") || semesters[0] || {}
      const tasks = (wx.getStorageSync("assessmentTasks") || []).map(item => {
        const assessment = assessments.find(scale => scale.id === item.assessmentId) || {}
        const linkedSemester = semesters.find(semester => semester.id === item.semesterId || semester.name === item.semester) || current
        return Object.assign({}, item, {
          semesterId: item.semesterId || linkedSemester.id || "",
          semester: item.semester === "当前学期" ? (linkedSemester.name || "未关联学期") : (item.semester || linkedSemester.name || "未关联学期"),
          questionnaireVersion: item.questionnaireVersion || assessment.questionnaireVersion || scoringEngine.QUESTIONNAIRE_VERSION,
          scoringVersion: item.scoringVersion || scoringEngine.SCORING_VERSION
        })
      })
      if (tasks.length) wx.setStorageSync("assessmentTasks", tasks)
      wx.setStorageSync("schemaVersion", 3)
    }
  },

  initLocalDemoData() {
    this.setDefaultStorage("assessments", this.getAssessments())
    this.setDefaultStorage("articles", this.getArticles())
    this.setDefaultStorage("civicsArticles", this.getCivicsArticles())
    this.setDefaultStorage("assessmentTasks", this.getAssessmentTasks())
    this.setDefaultStorage("assessmentResults", this.getAssessmentResults())
    this.setDefaultStorage("classStudents", this.getClassStudents())
    this.setDefaultStorage("riskEvents", this.getRiskEvents())
    this.setDefaultStorage("followupRecords", [])
    this.setDefaultStorage("semesters", this.getSemesters())
    this.setDefaultStorage("auditLogs", this.getAuditLogs())
    this.setDefaultStorage("consentRecords", [])
  },

  getAssessments() {
    return [
      { id: 1, name: "情绪压力量表(SAS)", description: "了解近期紧张与压力状态，共20题", questions: 20, duration: 5, category: "情绪压力", color: "#f4a3a8", status: "待完成" },
      { id: 2, name: "心境状态量表(SDS)", description: "了解近期情绪与兴趣变化，共20题", questions: 20, duration: 5, category: "心境状态", color: "#8fc8b5", status: "待完成" },
      { id: 3, name: "学业压力量表", description: "了解学业压力来源与影响，共15题", questions: 15, duration: 4, category: "学业压力", color: "#8fc1e0", status: "待完成" },
      { id: 4, name: "人际关系评估", description: "了解人际适应与社交困扰，共15题", questions: 15, duration: 4, category: "人际关系", color: "#b8a9d4", status: "可选" },
      { id: 5, name: "情绪调节能力测试", description: "了解情绪觉察与管理方式，共12题", questions: 12, duration: 3, category: "情绪调节", color: "#f5d79e", status: "可选" },
      { id: 6, name: "自尊量表(SES)", description: "了解自我价值感与自我接纳，共10题", questions: 10, duration: 3, category: "自我认知", color: "#f7b7a0", status: "可选" },
      { id: 7, name: "睡眠质量评估(PSQI)", description: "了解近期睡眠质量，共10题", questions: 10, duration: 3, category: "睡眠健康", color: "#c9b1d0", status: "可选" },
      { id: 8, name: "心理韧性量表(CD-RISC)", description: "了解面对挫折时的恢复能力，共12题", questions: 12, duration: 3, category: "自我成长", color: "#95d0c0", status: "可选" }
    ].map(item => Object.assign(item, {
      questionnaireVersion: scoringEngine.QUESTIONNAIRE_VERSION,
      scoringVersion: scoringEngine.SCORING_VERSION
    }))
  },

  getArticles() {
    return [
      { id: 1, title: "如何缓解考试压力？5个实用技巧", cover: "/images/articles/article_stress.png", summary: "从任务拆分、呼吸放松和睡眠管理开始，建立可执行的考前节奏。", views: 1256, category: "压力管理", author: "校心理中心", reviewer: "周老师", createTime: "2026-07-16", updateTime: "2026-07-18" },
      { id: 2, title: "人际交往心理学：如何建立良好关系", cover: "/images/articles/article_social.png", summary: "学习表达、倾听与边界感，让关系成为支持而不是额外负担。", views: 892, category: "人际关系", author: "校心理中心", reviewer: "李老师", createTime: "2026-07-15", updateTime: "2026-07-15" },
      { id: 3, title: "认识自我：发现你的独特价值", cover: "/images/articles/article_growth.png", summary: "从优势、兴趣和价值观三个角度认识自己。", views: 654, category: "自我成长", author: "学生发展中心", reviewer: "王老师", createTime: "2026-07-14", updateTime: "2026-07-14" },
      { id: 4, title: "失眠怎么办？科学助眠方法大全", cover: "/images/articles/article_mood.png", summary: "建立稳定作息、减少睡前刺激，并识别何时需要专业帮助。", views: 1432, category: "睡眠健康", author: "校心理中心", reviewer: "周老师", createTime: "2026-07-13", updateTime: "2026-07-17" },
      { id: 5, title: "情绪管理：学会与情绪和平相处", cover: "/images/articles/article_anxiety.png", summary: "情绪没有好坏，觉察和选择回应方式才是关键。", views: 876, category: "情绪调节", author: "校心理中心", reviewer: "李老师", createTime: "2026-07-12", updateTime: "2026-07-12" },
      { id: 6, title: "大学恋爱心理：建立健康的亲密关系", cover: "/images/articles/article_love.png", summary: "健康关系建立在平等、尊重、独立与沟通之上。", views: 2345, category: "恋爱与情感", author: "校心理中心", reviewer: "周老师", createTime: "2026-07-11", updateTime: "2026-07-11" },
      { id: 7, title: "职业规划：找到你的发展方向", cover: "/images/articles/article_growth.png", summary: "通过实践逐步验证兴趣、能力和价值选择。", views: 1567, category: "就业规划", author: "就业指导中心", reviewer: "陈老师", createTime: "2026-07-10", updateTime: "2026-07-10" },
      { id: 8, title: "什么时候应该寻求专业帮助？", cover: "/images/articles/article_stress.png", summary: "持续困扰、明显影响生活或出现安全风险时，请尽快联系专业人员。", views: 987, category: "求助指南", author: "校心理中心", reviewer: "周老师", createTime: "2026-07-09", updateTime: "2026-07-19" }
    ]
  },

  getCivicsArticles() {
    return [
      { id: 1, title: "把个人成长融入时代发展", category: "理想信念", summary: "从专业学习和社会实践中理解责任、选择与成长。", content: "大学阶段既是知识积累期，也是价值观逐渐成熟的重要阶段。把个人兴趣、专业能力与社会需要结合起来，可以帮助我们建立更稳定的目标感。\n\n目标不是要求所有人选择同一条道路，而是鼓励每位同学在充分了解自己、尊重事实和理解社会的基础上，形成理性、负责且能够行动的选择。", author: "王辅导员", reviewer: "学生工作部", publishTime: "2026-08-01", status: "已发布" },
      { id: 2, title: "理性表达：在分歧中保持尊重", category: "网络素养", summary: "辨别信息来源，用事实和善意参与公共讨论。", content: "面对复杂信息时，可以先确认来源、区分事实与观点，再判断是否转发。表达不同意见时，讨论观点而不是攻击个人。\n\n理性并不意味着没有立场，而是愿意用可靠证据检验自己的判断，也愿意尊重他人的人格和合法权利。", author: "王辅导员", reviewer: "宣传部", publishTime: "2026-07-26", status: "已发布" },
      { id: 3, title: "志愿服务中的责任与互助", category: "社会实践", summary: "在真实行动中理解合作、规则和公共责任。", content: "志愿服务的价值不仅在于完成时长，更在于理解他人的真实需要并提供负责任的帮助。参与前做好准备，服务中尊重对象，结束后复盘改进，能够让善意变得更专业、更可持续。", author: "赵辅导员", reviewer: "团委", publishTime: "2026-07-20", status: "已发布" }
    ]
  },

  getAssessmentTasks() {
    return [
      { id: 101, assessmentId: 1, title: "秋季学期心理状态普测", semesterId: "2026-1", semester: "2026-2027学年第一学期", questionnaireVersion: "1.0.0", scoringVersion: "2.0.0", deadline: "2026-09-30", status: "进行中", completed: false },
      { id: 102, assessmentId: 3, title: "期中学业压力自评", semesterId: "2026-1", semester: "2026-2027学年第一学期", questionnaireVersion: "1.0.0", scoringVersion: "2.0.0", deadline: "2026-11-15", status: "未开始", completed: false },
      { id: 103, assessmentId: 7, title: "睡眠健康自查", semesterId: "2026-1", semester: "2026-2027学年第一学期", questionnaireVersion: "1.0.0", scoringVersion: "2.0.0", deadline: "2026-10-20", status: "进行中", completed: true }
    ]
  },

  getAssessmentResults() {
    return [
      { id: 10001, studentId: "2024001", assessmentId: 7, assessmentName: "睡眠质量评估(PSQI)", score: 22, total: 10, stdScore: 55, normalizedRiskScore: 45, level: "关注", riskLevel: "关注", semesterId: "2025-2", semesterName: "2025-2026学年第二学期", questionnaireVersion: "legacy-1.0", scoringVersion: "legacy-1.0", dimensions: [{ label: "情绪状态", value: 72 }, { label: "压力负荷", value: 60 }, { label: "睡眠精力", value: 48 }, { label: "人际适应", value: 78 }, { label: "学业适应", value: 66 }], date: "2026-07-25" }
    ]
  },

  getClassStudents() {
    return [
      { studentId: "2024001", studentName: "张同学", classId: "CS2401", className: "计科2401", grade: "大二", major: "计算机科学与技术", completion: "已完成", riskLevel: "关注", latestScore: 55 },
      { studentId: "2024002", studentName: "李同学", classId: "CS2401", className: "计科2401", grade: "大二", major: "计算机科学与技术", completion: "已完成", riskLevel: "正常", latestScore: 76 },
      { studentId: "2024003", studentName: "王同学", classId: "CS2401", className: "计科2401", grade: "大二", major: "计算机科学与技术", completion: "未完成", riskLevel: "未评估", latestScore: 0 },
      { studentId: "2024004", studentName: "陈同学", classId: "CS2401", className: "计科2401", grade: "大二", major: "计算机科学与技术", completion: "已完成", riskLevel: "较高风险", latestScore: 38 },
      { studentId: "2024101", studentName: "周同学", classId: "AI2401", className: "人工智能2401", grade: "大二", major: "人工智能", completion: "已完成", riskLevel: "正常", latestScore: 82 },
      { studentId: "2024102", studentName: "吴同学", classId: "AI2401", className: "人工智能2401", grade: "大二", major: "人工智能", completion: "未完成", riskLevel: "未评估", latestScore: 0 }
    ]
  },

  getRiskEvents() {
    return [
      { id: 9001, studentId: "2024004", studentName: "陈同学", className: "计科2401", level: "较高风险", source: "秋季学期心理状态普测", createdAt: "2026-08-03 10:20", status: "待确认", summary: "多个维度持续偏低，建议由有权限人员人工复核。" },
      { id: 9002, studentId: "2024001", studentName: "张同学", className: "计科2401", level: "关注", source: "睡眠健康自查", createdAt: "2026-07-25 15:40", status: "跟进中", summary: "睡眠与精力维度需要关注，已推荐自助内容。" }
    ]
  },

  getSemesters() {
    return [
      { id: "2026-1", name: "2026-2027学年第一学期", status: "当前学期", startDate: "2026-09-01", endDate: "2027-01-20" },
      { id: "2025-2", name: "2025-2026学年第二学期", status: "已归档", startDate: "2026-02-23", endDate: "2026-07-10" }
    ]
  },

  getAuditLogs() {
    return [
      { id: 1, operator: "系统管理员", action: "创建演示学期", time: "2026-08-01 09:00" },
      { id: 2, operator: "王辅导员", action: "查看班级风险摘要", time: "2026-08-03 11:10" }
    ]
  }
})
