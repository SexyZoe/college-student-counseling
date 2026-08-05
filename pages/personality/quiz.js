const typeData = require("../../utils/mbti")

Page({
  data: { questions: [], currentIndex: 0, answers: [], selectedOption: -1, progress: 0 },

  onLoad() {
    const questions = typeData.MBTI_QUESTIONS
    const saved = wx.getStorageSync("type16Draft") || {}
    const answers = saved.answers || new Array(questions.length).fill(-1)
    const currentIndex = Math.min(saved.currentIndex || 0, questions.length - 1)
    this.setData({
      questions,
      answers,
      currentIndex,
      selectedOption: answers[currentIndex] === undefined ? -1 : answers[currentIndex],
      progress: Math.round((currentIndex / questions.length) * 100)
    })
  },

  selectOption(e) {
    const selectedOption = parseInt(e.currentTarget.dataset.option)
    const answers = this.data.answers.slice()
    answers[this.data.currentIndex] = selectedOption
    this.setData({ answers, selectedOption })
    wx.setStorageSync("type16Draft", { answers, currentIndex: this.data.currentIndex })
    setTimeout(() => {
      if (this.data.currentIndex < this.data.questions.length - 1) this.moveTo(this.data.currentIndex + 1)
      else this.calculateResult()
    }, 220)
  },

  moveTo(index) {
    this.setData({
      currentIndex: index,
      selectedOption: this.data.answers[index] === undefined ? -1 : this.data.answers[index],
      progress: Math.round((index / this.data.questions.length) * 100)
    })
    wx.setStorageSync("type16Draft", { answers: this.data.answers, currentIndex: index })
  },

  calculateResult() {
    const calculated = typeData.calculateType(this.data.answers)
    const base = calculated.result
    const result = {
      mbtiType: calculated.type,
      name: base.name,
      title: base.title,
      desc: base.description,
      color: base.color,
      emoji: "🧭",
      strengths: base.strengths.split("、"),
      growth: ["把类型当作观察自己的起点，而不是固定标签", "在不同情境中尝试不熟悉但有帮助的行为方式", "重要选择仍应结合能力、兴趣、价值观与现实条件"],
      careers: base.careers,
      scores: calculated.scores
    }
    wx.setStorageSync("personalityResult", result)
    wx.removeStorageSync("type16Draft")
    wx.redirectTo({ url: "/pages/personality/result" })
  },

  goBack() {
    if (this.data.currentIndex > 0) this.moveTo(this.data.currentIndex - 1)
    else wx.navigateBack()
  }
})
