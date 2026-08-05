 // MBTI 人格类型测试数据
 // 28道题目（7题 × 4维度）+ 16种人格结果

 // MBTI 题目（每题两个选项，分别对应两个维度的倾向）
 var MBTI_QUESTIONS = [
   // E/I 维度（外向/内向）7题
   { id: 1, dimension: "EI", title: "在聚会或社交场合中，你通常会", options: [
     { label: "A", text: "主动和很多人交谈，精力充沛", direction: "E" },
     { label: "B", text: "更愿意和一两个熟悉的朋友深入交流", direction: "I" }
   ]},
   { id: 2, dimension: "EI", title: "独处一段时间后，你通常感到", options: [
     { label: "A", text: "精力被消耗，想找人聊天", direction: "E" },
     { label: "B", text: "精力得到恢复，内心平静", direction: "I" }
   ]},
   { id: 3, dimension: "EI", title: "在团队讨论中，你倾向于", options: [
     { label: "A", text: "边说边想，通过讨论来理清思路", direction: "E" },
     { label: "B", text: "先想好再发言，在脑海中整理观点", direction: "I" }
   ]},
   { id: 4, dimension: "EI", title: "你更喜欢的工作方式是", options: [
     { label: "A", text: "在开放空间中与团队密切协作", direction: "E" },
     { label: "B", text: "在安静的独立空间中专注工作", direction: "I" }
   ]},
   { id: 5, dimension: "EI", title: "遇到困难时，你通常", options: [
     { label: "A", text: "立即找朋友倾诉和讨论", direction: "E" },
     { label: "B", text: "先自己思考消化，再选择性分享", direction: "I" }
   ]},
   { id: 6, dimension: "EI", title: "认识新朋友时，你通常", options: [
     { label: "A", text: "主动开启话题，感觉自然轻松", direction: "E" },
     { label: "B", text: "等待对方先开口，观察后再回应", direction: "I" }
   ]},
   { id: 7, dimension: "EI", title: "在周末你会更倾向于", options: [
     { label: "A", text: "安排社交活动，和朋友一起度过", direction: "E" },
     { label: "B", text: "留出独处时间，看书或做自己喜欢的事", direction: "I" }
   ]},

   // S/N 维度（实感/直觉）7题
   { id: 8, dimension: "SN", title: "学习新知识时，你更喜欢", options: [
     { label: "A", text: "从具体案例和实际操作入手", direction: "S" },
     { label: "B", text: "先了解整体概念和理论框架", direction: "N" }
   ]},
   { id: 9, dimension: "SN", title: "在解决问题时，你更依赖", options: [
     { label: "A", text: "过去的经验和已验证的方法", direction: "S" },
     { label: "B", text: "灵感和新的可能性", direction: "N" }
   ]},
   { id: 10, dimension: "SN", title: "阅读一本书时，你更关注", options: [
     { label: "A", text: "具体的故事情节和细节描写", direction: "S" },
     { label: "B", text: "文字背后的隐喻和深层含义", direction: "N" }
   ]},
   { id: 11, dimension: "SN", title: "做决定时，你更看重", options: [
     { label: "A", text: "现实条件和可操作性", direction: "S" },
     { label: "B", text: "未来的可能性和创新性", direction: "N" }
   ]},
   { id: 12, dimension: "SN", title: "描述一件事时，你倾向于", options: [
     { label: "A", text: "用具体的细节和事实来说明", direction: "S" },
     { label: "B", text: "用比喻和联想来表达", direction: "N" }
   ]},
   { id: 13, dimension: "SN", title: "你更欣赏哪种类型的老师", options: [
     { label: "A", text: "条理清晰、按部就班讲解的", direction: "S" },
     { label: "B", text: "善于启发、鼓励发散思维的", direction: "N" }
   ]},
   { id: 14, dimension: "SN", title: "对待规则和流程的态度", options: [
     { label: "A", text: "尊重规则，按照既定流程做事", direction: "S" },
     { label: "B", text: "喜欢灵活变通，探索更好的方法", direction: "N" }
   ]},

   // T/F 维度（思考/情感）7题
   { id: 15, dimension: "TF", title: "朋友向你倾诉烦恼时，你首先会", options: [
     { label: "A", text: "帮忙分析问题，给出解决建议", direction: "T" },
     { label: "B", text: "表达理解和安慰，陪伴倾听", direction: "F" }
   ]},
   { id: 16, dimension: "TF", title: "做重要决定时，你主要依靠", options: [
     { label: "A", text: "逻辑分析和客观标准", direction: "T" },
     { label: "B", text: "个人价值观和内心感受", direction: "F" }
   ]},
   { id: 17, dimension: "TF", title: "在团队合作中，你更重视", options: [
     { label: "A", text: "任务完成效率和质量", direction: "T" },
     { label: "B", text: "团队氛围和成员关系", direction: "F" }
   ]},
   { id: 18, dimension: "TF", title: "面对批评时，你通常会", options: [
     { label: "A", text: "理性分析批评是否有道理", direction: "T" },
     { label: "B", text: "首先感受到情绪的波动", direction: "F" }
   ]},
   { id: 19, dimension: "TF", title: "你更认同以下哪种说法", options: [
     { label: "A", text: "公平比善良更重要", direction: "T" },
     { label: "B", text: "善良比公平更重要", direction: "F" }
   ]},
   { id: 20, dimension: "TF", title: "解决冲突时，你倾向于", options: [
     { label: "A", text: "直接指出问题，寻求客观解决方案", direction: "T" },
     { label: "B", text: "照顾各方感受，寻求和谐共识", direction: "F" }
   ]},
   { id: 21, dimension: "TF", title: "判断一个人的行为对错时，你更看重", options: [
     { label: "A", text: "行为是否符合规则和逻辑", direction: "T" },
     { label: "B", text: "行为背后的动机和情境", direction: "F" }
   ]},

   // J/P 维度（判断/感知）7题
   { id: 22, dimension: "JP", title: "对待日程安排，你喜欢", options: [
     { label: "A", text: "提前制定详细计划，按部就班执行", direction: "J" },
     { label: "B", text: "保持灵活，随时根据情况调整", direction: "P" }
   ]},
   { id: 23, dimension: "JP", title: "截止日期临近时，你通常", options: [
     { label: "A", text: "早早开始准备，提前完成任务", direction: "J" },
     { label: "B", text: "在压力驱动下高效赶工", direction: "P" }
   ]},
   { id: 24, dimension: "JP", title: "对于不确定的事情，你的态度是", options: [
     { label: "A", text: "尽快做决定以消除不确定性", direction: "J" },
     { label: "B", text: "保持开放，等待更多信息再决定", direction: "P" }
   ]},
   { id: 25, dimension: "JP", title: "你的桌面或房间通常", options: [
     { label: "A", text: "整洁有序，物品放在固定位置", direction: "J" },
     { label: "B", text: "随性摆放，但你知道东西在哪", direction: "P" }
   ]},
   { id: 26, dimension: "JP", title: "旅行时你更喜欢", options: [
     { label: "A", text: "提前规划好路线和行程", direction: "J" },
     { label: "B", text: "随心所欲，走到哪算哪", direction: "P" }
   ]},
   { id: 27, dimension: "JP", title: "你更倾向于哪种学习方式", options: [
     { label: "A", text: "按大纲系统性学习，逐步推进", direction: "J" },
     { label: "B", text: "根据兴趣跳跃式学习，深度探索", direction: "P" }
   ]},
   { id: 28, dimension: "JP", title: "事情告一段落后，你通常会", options: [
     { label: "A", text: "立即规划下一个目标", direction: "J" },
     { label: "B", text: "先放松一下，顺其自然", direction: "P" }
   ]}
 ];

 // MBTI 16种人格结果
 var MBTI_RESULTS = {
   "ISTJ": { name: "ISTJ — 检查者", title: "务实可靠的组织者", description: "你是一个认真负责、注重细节的人。你做事有条理，尊重传统和规则，是团队中可靠的中坚力量。你以事实为依据做决定，善于制定计划并严格执行。", strengths: "可靠稳定、组织能力强、注重实际、责任感强", careers: "会计师、审计师、项目经理、公务员、医生", color: "#8fc8b5" },
   "ISFJ": { name: "ISFJ — 守护者", title: "温暖细心的守护者", description: "你温暖、有同理心，对身边的人关怀备至。你善于观察他人的需求，默默付出却不求回报。你注重细节，有出色的记忆力和执行力。", strengths: "忠诚体贴、细心周到、善于照顾他人、坚韧持久", careers: "护士、教师、社工、行政人员、心理咨询师", color: "#f5d79e" },
   "INFJ": { name: "INFJ — 提倡者", title: "理想主义的洞察者", description: "你拥有深邃的洞察力和坚定的价值观。你善于理解他人的内心世界，渴望为世界带来积极的改变。你有创造力且目标明确，但需要独处来补充能量。", strengths: "洞察力强、富有创意、坚持原则、善解人意", careers: "咨询师、作家、教育工作者、人力资源、设计师", color: "#b8a9d4" },
   "INTJ": { name: "INTJ — 建筑师", title: "独立思考的战略家", description: "你擅长战略性思考，喜欢分析和规划。你对复杂系统有天然的领悟力，追求知识和能力的不断突破。你独立自信，不会随波逐流。", strengths: "战略思维、独立自主、善于规划、追求卓越", careers: "科学家、工程师、企业管理者、律师、教授", color: "#8fc1e0" },
   "ISTP": { name: "ISTP — 鉴赏家", title: "冷静灵活的实干者", description: "你擅长动手操作，喜欢理解和修理事物。你冷静理性，在危机时刻能够保持镇定。你享受动手实践的过程，喜欢用最简洁有效的方法解决问题。", strengths: "动手能力强、冷静理性、灵活应变、善于分析", careers: "工程师、技术专家、飞行员、外科医生、侦探", color: "#f4a3a8" },
   "ISFP": { name: "ISFP — 探险家", title: "温和艺术的探索者", description: "你性格温和、谦虚低调，拥有丰富的内心和审美感受力。你喜欢用自己的方式去探索世界，欣赏生活中的美好。你尊重他人的价值观和个人空间。", strengths: "审美敏锐、温和包容、忠于自我、适应力强", careers: "设计师、艺术家、音乐人、宠物医生、花艺师", color: "#f7b7a0" },
   "INFP": { name: "INFP — 调停者", title: "理想主义的治愈者", description: "你充满理想和热情，忠于自己的价值观。你善于理解他人的痛苦，渴望帮助他人找到人生的意义。你有丰富的想象力和创造力。", strengths: "富有同情心、创造力强、忠于理想、善于倾听", careers: "作家、心理咨询师、教师、公益工作者、设计师", color: "#c9b1d0" },
   "INTP": { name: "INTP — 逻辑学家", title: "创新思考的理论家", description: "你热爱思考和理论探索，对知识有着无尽的好奇心。你喜欢分析和解构问题，追求逻辑的严谨与优雅。你不容易被常规思维束缚，总能提出独特的见解。", strengths: "逻辑严密、思维创新、求知欲强、客观公正", careers: "科学家、程序员、哲学家、数学家、分析师", color: "#95d0c0" },
   "ESTP": { name: "ESTP — 企业家", title: "精力充沛的行动派", description: "你充满活力和冒险精神，喜欢刺激和挑战。你善于随机应变，在快节奏的环境中如鱼得水。你现实而直接，喜欢用行动而不是言语来解决问题。", strengths: "行动力强、适应力好、善于社交、现实果断", careers: "销售人员、创业者、急救人员、运动员、经纪人", color: "#f4a3a8" },
   "ESFP": { name: "ESFP — 表演者", title: "热情洋溢的乐天派", description: "你乐观开朗，享受与人相处的每一刻。你善于营造快乐的氛围，是聚会的灵魂人物。你活在当下，善于发现生活中的乐趣和美好。", strengths: "热情开朗、善于社交、乐观积极、审美敏锐", careers: "演员、销售、导游、活动策划、幼儿园老师", color: "#f5d79e" },
   "ENFP": { name: "ENFP — 竞选者", title: "热情自由的梦想家", description: "你充满感染力和创造力，善于发现每个人身上的潜力。你对未来充满憧憬，喜欢探索各种可能性。你有出色的社交能力，能轻松与不同的人建立联系。", strengths: "富有感染力、想象力丰富、善于激励他人、开放包容", careers: "记者、公关、创业者、培训师、心理咨询师", color: "#b8a9d4" },
   "ENTP": { name: "ENTP — 辩论家", title: "机智善辩的创新者", description: "你思维敏捷、善于辩论，喜欢挑战传统观点。你乐于探索新想法，对知识有着广泛而深厚的兴趣。你不怕表达反对意见，享受智力上的碰撞。", strengths: "思维敏捷、善于创新、敢于挑战、表达能力强", careers: "企业家、律师、发明家、记者、产品经理", color: "#8fc1e0" },
   "ESTJ": { name: "ESTJ — 总经理", title: "高效务实的组织者", description: "你组织能力强，善于制定和执行计划。你重视效率和秩序，是天生的管理者。你诚实直率，说到做到，值得信赖。", strengths: "组织领导力、高效务实、诚实守信、责任心强", careers: "管理者、军官、法官、财务主管、校长", color: "#8fc8b5" },
   "ESFJ": { name: "ESFJ — 执政官", title: "热心周到的协调者", description: "你关心他人、乐于助人，善于创造和谐的人际环境。你责任心强，总是尽力照顾好身边的人。你注重传统和礼仪，是社区中的支柱人物。", strengths: "协调能力强、关怀他人、责任心强、善于沟通", careers: "教师、医生、客服经理、社区工作者、护理人员", color: "#f5d79e" },
   "ENFJ": { name: "ENFJ — 主人公", title: "富有魅力的引领者", description: "你天生具有领导才能和感染力，善于激励他人发挥潜力。你对他人有着真诚的关怀，愿意为了团队的目标付出努力。你有强烈的责任感和使命感。", strengths: "领导力强、善于激励、富有同理心、沟通出色", careers: "管理者、教师、培训师、政治家、心理咨询师", color: "#b8a9d4" },
   "ENTJ": { name: "ENTJ — 指挥官", title: "果断坚毅的领导者", description: "你天生就是领导者，善于制定策略并高效执行。你果断、自信，不怕承担困难的任务。你有远见，善于组织和调动资源来达成目标。", strengths: "领导力卓越、战略眼光、果断高效、勇于担当", careers: "CEO、政治家、高级军官、企业家、管理顾问", color: "#8fc1e0" }
 };

 // MBTI 评估维度标签
 var MBTI_DIMENSIONS = {
   "EI": { left: "外向E", right: "内向I", leftDesc: "从外部世界获取能量", rightDesc: "从内心世界获取能量" },
   "SN": { left: "实感S", right: "直觉N", leftDesc: "关注具体事实和细节", rightDesc: "关注整体模式和可能" },
   "TF": { left: "思考T", right: "情感F", leftDesc: "以逻辑和原则做决定", rightDesc: "以价值观和感受做决定" },
   "JP": { left: "判断J", right: "感知P", leftDesc: "喜欢计划和确定", rightDesc: "喜欢灵活和随性" }
 };

 module.exports = {
   MBTI_QUESTIONS: MBTI_QUESTIONS,
   MBTI_RESULTS: MBTI_RESULTS,
   MBTI_DIMENSIONS: MBTI_DIMENSIONS,

   // 根据回答计算MBTI类型
   calculateType: function(answers) {
     var scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
     for (var i = 0; i < MBTI_QUESTIONS.length; i++) {
       var q = MBTI_QUESTIONS[i];
       if (answers[i] !== undefined && answers[i] < q.options.length) {
         var dir = q.options[answers[i]].direction;
         if (scores[dir] !== undefined) scores[dir]++;
       }
     }
     var type = "";
     type += scores.E >= scores.I ? "E" : "I";
     type += scores.S >= scores.N ? "S" : "N";
     type += scores.T >= scores.F ? "T" : "F";
     type += scores.J >= scores.P ? "J" : "P";
     return { type: type, scores: scores, result: MBTI_RESULTS[type] || MBTI_RESULTS["ISTJ"] };
   }
 };
