// pages/assessment/result.js
var resultsData = {"sas":{"name":"情绪压力量表(SAS)","ranges":[{"min":20,"max":35,"level":"压力适度","levelColor":"#8fc8b5","levelDesc":"你的情绪压力处于适度范围，情绪状态良好。"},{"min":36,"max":49,"level":"压力偏高","levelColor":"#f5d79e","levelDesc":"存在压力偏高倾向，建议关注自我调节。"},{"min":50,"max":59,"level":"压力较高","levelColor":"#f7b7a0","levelDesc":"压力水平偏高，建议尝试放松训练并关注变化。"},{"min":60,"max":80,"level":"压力过高","levelColor":"#f4a3a8","levelDesc":"压力水平较高，建议寻求专业心理帮助。"}],"analysis":{"正常":"测评结果显示你的压力水平处于正常范围。你的情绪状态较为平稳，能够较好地应对日常生活中的各种事件。建议继续保持现有的生活习惯和社交节奏，适当关注自身情绪变化即可。","压力偏高":"你的压力水平略高于正常范围，表现为在某些情境下可能会感到紧张和担忧。这在大学生群体中较为常见，通常与学业压力和生活变化有关。建议你可以通过规律运动、深呼吸练习和正念冥想来调节。","压力较高":"你的压力量表得分处于中等偏高水平。你可能在日常生活中有多处感受到情绪紧张，且这些情绪已经开始影响到你的睡眠、食欲或社交。建议你积极进行放松训练，并考虑预约一次心理咨询。","压力过高":"测评结果显示你的压力水平较高。你可能正在经历持续的不安、紧张和担忧，甚至在无明显压力源时也会感到紧张。这已经对你的日常生活造成了显著影响。强烈建议你尽快寻求专业心理咨询师的帮助。"},"suggestions":{"正常":["保持规律的作息和每周150分钟以上的运动","维持现有的社交支持网络","每天抽5分钟进行深呼吸练习"],"压力偏高":["学习腹式呼吸法，每天早晚各练习5分钟","减少咖啡因和糖分摄入","写情绪日记记录压力触发因素","尝试使用冥想小程序每天10分钟"],"压力较高":["预约一次校内心理咨询","练习渐进式肌肉放松法","每天安排30分钟的有氧运动","暂时减少学业负荷，优先保证睡眠"],"压力过高":["尽快预约专业心理咨询","向信任的老师或辅导员说明情况","避免独自长时间封闭自己","如影响进食睡眠请同时就医"]}},"sds":{"name":"心境状态量表(SDS)","ranges":[{"min":20,"max":40,"level":"压力适度","levelColor":"#8fc8b5","levelDesc":"你的情绪状态在正常范围内，没有明显的情绪低落表现。"},{"min":41,"max":52,"level":"情绪偏低","levelColor":"#f5d79e","levelDesc":"存在情绪偏低倾向，建议加强自我关怀和情绪调节。"},{"min":53,"max":62,"level":"情绪较低","levelColor":"#f7b7a0","levelDesc":"情绪状态需要关注，建议寻求专业评估和帮助。"},{"min":63,"max":80,"level":"情绪过低","levelColor":"#f4a3a8","levelDesc":"情绪长期低落，强烈建议尽快寻求专业心理援助。"}],"analysis":{"正常":"测评结果显示你当前情绪状态良好，对生活抱持积极态度，能够从日常活动中获得满足感。请继续保持健康的生活方式。","情绪偏低":"你近期的情绪有轻微低落的趋势，可能对某些原本感兴趣的活动感到动力不足。这在大学生活中并不少见，建议增加户外活动时间，多与人交流，避免长时间独处。","情绪较低":"测评结果提示你的情绪状态已达到需要主动调节的水平。你可能在多个维度上感受到困扰。建议你主动预约心理咨询，同时告知一位信任的朋友你的状况。","情绪过低":"你的心境量表得分较高，提示当前情绪困扰较为严重。你可能会感到持续的悲伤、对一切失去兴趣，甚至产生无望感。这些不是你的错，而是大脑需要帮助。请务必尽快联系心理咨询中心。"},"suggestions":{"正常":["保持每天至少30分钟户外活动","培养一个让你期待的爱好","与朋友保持每周至少2次交流"],"情绪偏低":["坚持每周3次以上有氧运动","尝试感恩日记，每天写下3件感恩的事","减少睡前使用手机的时间","参加一次社团活动或志愿者工作"],"情绪较低":["预约心理咨询是当前最重要的一步","让辅导员了解你的情况以便支持","制定每日小目标，完成后给自己肯定","暂时放下过高的学业要求"],"情绪过低":["立即联系校内24小时心理援助热线","让一位信任的人陪伴你度过困难时期","不去比较自己和他人，专注当下的每一步","紧急情况下请直接联系辅导员或前往校医院"]}},"stress":{"name":"学业压力量表","ranges":[{"min":15,"max":25,"level":"压力正常","levelColor":"#8fc8b5","levelDesc":"学业压力在可控范围内。"},{"min":26,"max":38,"level":"轻度压力","levelColor":"#f5d79e","levelDesc":"存在一定学业压力，需要适当调整。"},{"min":39,"max":48,"level":"中度压力","levelColor":"#f7b7a0","levelDesc":"学业压力较大，建议采取措施缓解。"},{"min":49,"max":60,"level":"高度压力","levelColor":"#f4a3a8","levelDesc":"学业压力过大，身心可能已受影响。"}],"analysis":{"压力正常":"你的学业压力处于健康水平。你对学习保持适度的投入，不会因为学业而过度紧张。这种状态最有利于长期的学习效果和身心健康。","轻度压力":"你正经历一定程度的学业压力，这在一定程度上可能提高了你的学习动力，但长期如此可能消耗你的精力。建议合理安排学习计划，避免堆积任务。","中度压力":"你的学业压力已明显影响到情绪和身体状态（如睡眠、注意力）。建议主动调整学习策略，分解大任务为小目标，必要时与老师沟通学业困难，不要一个人死撑。","高度压力":"你的学业压力已处于较高水平，可能已经引发了持续紧张、失眠或身体不适等反应。请立即停止\"逼自己\"的模式，暂时减少学业负担，优先照顾身心健康。"},"suggestions":{"压力正常":["保持当前的学习节奏和休息平衡","尝试每周尝试一个新的学习方法","定期复盘学习效果，优化策略"],"轻度压力":["使用番茄工作法(25分钟学习+5分钟休息)","建立每周学习计划，不要临考突击","每天保证7-8小时睡眠","学习说\"不\"，不要接太多课外任务"],"中度压力":["与任课老师沟通，了解提升空间","减少手机和社交媒体使用时间","找一个学习伙伴互相监督鼓励","每周安排完全放松的半日"],"高度压力":["优先保证睡眠，暂时降低对成绩的期望","向辅导员说明学业压力情况","考虑申请缓考或减少本学期课程","不要用自我惩罚的方式逼自己学习"]}},"relate":{"name":"人际关系评估","ranges":[{"min":15,"max":25,"level":"适应良好","levelColor":"#8fc8b5","levelDesc":"人际交往能力良好。"},{"min":26,"max":38,"level":"轻微困扰","levelColor":"#f5d79e","levelDesc":"在人际交往中有轻微困扰。"},{"min":39,"max":48,"level":"中度困扰","levelColor":"#f7b7a0","levelDesc":"人际关系方面存在一定困难。"},{"min":49,"max":60,"level":"严重困扰","levelColor":"#f4a3a8","levelDesc":"人际关系困扰较大，建议寻求帮助。"}],"analysis":{"适应良好":"你在人际交往中表现得自信、自然，能够轻松地与他人建立和维持关系。这是心理韧性的重要组成部分，请继续发挥你的社交优势。","轻微困扰":"你在某些社交场景（如与陌生人交流、课堂发言）中可能会感到轻微紧张或不自在。这是很正常的现象，适当练习即可改善。","中度困扰":"你在人际关系中可能经常感到压力，比如害怕被评价、难以表达真实想法或在冲突后久久无法释怀。建议学习一些沟通技巧，在安全的环境中练习表达。","严重困扰":"你的人际困扰程度较高，可能在社交中感到强烈的紧张，甚至因此回避社交场合。这种情况已经对你的生活造成了明显影响。建议通过心理咨询帮助你逐步重建对人际关系的信心。"},"suggestions":{"适应良好":["保持真诚的自我表达","尝试帮助那些在社交中感到困难的同学","继续拓展多元化的社交圈子"],"轻微困扰":["从小的社交互动开始练习（比如主动和同学打招呼）","准备几个聊天话题可以在尴尬时使用","记住大多数人都更关注自己而不是你"],"中度困扰":["参加一个以共同兴趣为基础的社团活动","学习非暴力沟通模型表达自己的想法","阅读《沟通的艺术》等心理学书籍"],"严重困扰":["预约心理咨询探索社交紧张的根源","不要强迫自己成为\"外向者\"，接受自己的社交节奏","寻找一两个愿意倾听的朋友作为安全练习对象"]}},"emotion":{"name":"情绪调节能力测试","ranges":[{"min":12,"max":20,"level":"调节良好","levelColor":"#8fc8b5","levelDesc":"情绪觉察和管理能力较强。"},{"min":21,"max":30,"level":"调节一般","levelColor":"#f5d79e","levelDesc":"情绪调节能力中等,有提升空间。"},{"min":31,"max":38,"level":"调节较弱","levelColor":"#f7b7a0","levelDesc":"情绪容易被外界影响，需要加强练习。"},{"min":39,"max":48,"level":"调节困难","levelColor":"#f4a3a8","levelDesc":"情绪波动大，可能在日常生活中感到困扰。"}],"analysis":{"调节良好":"你对自己的情绪有敏锐的觉察力，能够识别情绪变化并及时调整。这是心理健康的重要保护因素，请继续保持。","调节一般":"你有基本的情绪觉察能力，但在面对强烈情绪（如愤怒、悲伤）时可能不知道如何有效调控。好消息是情绪调节技能可以通过练习来提升。","调节较弱":"你的情绪容易被外界事件或他人言辞所影响，可能在冲动之下做出让自己后悔的行为。建议开始练习情绪觉察——在情绪升起时先停顿10秒再进行反应。","调节困难":"你可能经常感到情绪失控，比如突然的大哭、暴怒或长时间的麻木。这不是你的性格缺陷，而是需要学习的技能。强烈建议通过心理咨询学习专业的情绪调节技巧。"},"suggestions":{"调节良好":["将自己的情绪调节经验分享给需要帮助的人","在压力情境下继续保持当前的应对策略","偶尔尝试新方式拓宽调节能力"],"调节一般":["每天花2分钟记录当时的情绪和身体感受","学习STOP技术：暂停、深呼吸、观察、继续","找到最适合自己的减压方式(音乐/运动/写作)"],"调节较弱":["下载情绪追踪APP帮助培养觉察习惯","在感到情绪失控前主动离开争议场景","学习正念呼吸法，每天练习5分钟","和朋友约定一个\"冷静暗号\""],"调节困难":["寻求心理咨询进行认知行为治疗(CBT)","在安全环境下练习情绪表达","不要用酒精或其他方式麻痹情绪","紧急时拨打心理援助热线"]}},"self_esteem":{"name":"自尊量表(SES)","ranges":[{"min":10,"max":18,"level":"自尊较低","levelColor":"#f4a3a8","levelDesc":"自我价值感偏低，对自己缺乏信心。"},{"min":19,"max":26,"level":"自尊中等","levelColor":"#f5d79e","levelDesc":"自我价值感处于中等水平。"},{"min":27,"max":34,"level":"自尊良好","levelColor":"#8fc8b5","levelDesc":"你对自己有较积极的评价和认同感。"},{"min":35,"max":40,"level":"自尊很强","levelColor":"#8fc1e0","levelDesc":"你拥有非常健康的自我价值感。"}],"analysis":{"自尊较低":"你对自己的评价偏向负面，可能经常自我批评、觉得自己比不上他人。低自尊可能与成长经历有关，但它是可以改善的。重要的是要区分\"事实\"和\"自我评价\"。","自尊中等":"你对自我的看法有时积极有时消极。在熟悉的领域你可能比较自信，但面对新挑战时可能会怀疑自己。这是多数人的常态，可以通过练习来提升稳定性。","自尊良好":"你有健康的自我价值感，能够接纳自己的不完美，也认可自己的价值和能力。这种稳定的自我认同感是你面对生活挑战的坚实基础。","自尊很强":"你对自己有坚定的认同感，不会因为外界的评价而轻易动摇。你知道自己的价值不取决于成绩、外貌或他人的认可。这是一种成熟的心理状态。"},"suggestions":{"自尊较低":["每天写下1件你做得好的事（无论多小）","停止与他人比较，尤其是社交媒体上的假象","尝试新技能——能力感是从实践中建立的","考虑心理咨询探索自尊问题的根源"],"自尊中等":["练习对自己说肯定的话语（自我肯定练习）","列出你的5个优势并每天回顾","尝试独自完成一个挑战来证明自己的能力","减少在意外界的负面评价"],"自尊良好":["在团队中发挥你的领导力","帮助低自尊的朋友看到他们自己的价值","继续保持对自己的诚实和接纳"],"自尊很强":["注意不要过度自信而忽视他人感受","你的稳定自尊是帮助他人的重要资源","继续保持自我反思的习惯"]}},"sleep":{"name":"睡眠质量评估(PSQI)","ranges":[{"min":10,"max":17,"level":"睡眠良好","levelColor":"#8fc8b5","levelDesc":"睡眠质量良好，暂无明显睡眠问题。"},{"min":18,"max":28,"level":"轻微问题","levelColor":"#f5d79e","levelDesc":"存在轻微睡眠问题，值得关注。"},{"min":29,"max":35,"level":"中度问题","levelColor":"#f7b7a0","levelDesc":"睡眠质量明显下降，需要采取措施。"},{"min":36,"max":40,"level":"严重问题","levelColor":"#f4a3a8","levelDesc":"睡眠问题严重，建议专业评估。"}],"analysis":{"睡眠良好":"你的睡眠质量处于正常范围。好的睡眠是心理健康的基础，请继续保持良好的睡眠习惯。","轻微问题":"你偶尔会遇到入睡困难或睡眠中断的情况，可能与近期的学业压力或生活变化有关。建议从现在开始关注睡眠习惯。","中度问题":"你目前的睡眠质量已明显下降，可能表现为入睡困难、早醒或睡眠浅。睡眠问题会\"放大\"其他心理健康问题，需要认真对待。","严重问题":"你正在经历严重的睡眠障碍，可能已经持续了一段时间。持续的失眠会严重影响情绪、注意力和身体健康。建议尽快寻求专业帮助。"},"suggestions":{"睡眠良好":["保持固定起床时间","睡前1小时减少屏幕使用","卧室保持温度18-22度"],"轻微问题":["建立睡前仪式","睡前避免咖啡和浓茶","用白噪音帮助入睡"],"中度问题":["建立固定的睡前仪式","白天至少30分钟户外运动","晚上22:00后调暗所有灯光","如果躺20分钟睡不着就起来"],"严重问题":["预约校医院或睡眠门诊","白天严格不补觉","晚上远离手机蓝光","考虑认知行为治疗失眠"]}},"resilience":{"name":"心理韧性量表(CD-RISC)","ranges":[{"min":12,"max":22,"level":"韧性较低","levelColor":"#f4a3a8","levelDesc":"你面对挫折时的复原力需要加强。"},{"min":23,"max":32,"level":"韧性中等","levelColor":"#f5d79e","levelDesc":"心理韧性处于中等水平。"},{"min":33,"max":42,"level":"韧性良好","levelColor":"#8fc8b5","levelDesc":"你具备良好的心理韧性。"},{"min":43,"max":48,"level":"韧性很强","levelColor":"#8fc1e0","levelDesc":"你的心理韧性非常强。"}],"analysis":{"韧性较低":"你目前应对挫折的内在资源相对有限。在遇到困难时可能容易感到不知所措。心理韧性不是一成不变的，它就像肌肉——可以通过练习变得更强。","韧性中等":"你有基本的应对能力，但在重大挫折面前可能会感到吃力。好消息是心理韧性是可以通过刻意练习来提升的。","韧性良好":"你拥有良好的心理韧性。你能够从挫折中恢复并从中学习。即使面对比较大的挑战，你也能调动自己的资源来应对。","韧性很强":"你的心理韧性非常出众。你不仅能在逆境中保持稳定，还能将挫折转化为成长的机会。请继续使用你的韧性优势。"},"suggestions":{"韧性较低":["从小挑战开始逐步建立自信","建立你的支持系统","学习积极自我对话","阅读励志故事"],"韧性中等":["尝试新事物拓展舒适区","练习在压力下保持冷静的呼吸技巧","建立困难日志记录每次克服的挑战"],"韧性良好":["挑战更有难度的目标","尝试做志愿工作拓宽人生视角","在团队中发挥你的韧性优势"],"韧性很强":["把你的韧性经验分享给他人","在高压环境下保持自我照顾","继续探索人生的意义感和目标感"]}}};

var scaleKeys = {1:"sas",2:"sds",3:"stress",4:"relate",5:"emotion",6:"self_esteem",7:"sleep",8:"resilience",9:"mbti"};
var auth = require('../../utils/auth');

// 五维雷达图维度定义（PRD Section 6.5）
var RADAR_DIMENSIONS = [
  { key: "emotion", label: "情绪状态" },
  { key: "stress", label: "压力负荷" },
  { key: "sleep", label: "睡眠精力" },
  { key: "social", label: "人际适应" },
  { key: "worth", label: "自我价值" }
];

Page({
  data: {
    score: 0, total: 0, percentage: 0, stdScore: 0,
    level: "", levelColor: "", levelDesc: "",
    analysis: "", suggestions: [], assessmentName: "",
    assessmentId: 0,
    dimensions: [],
    historyCount: 0
  },

  onLoad: function(options) {
    if (!auth.requireRole('student')) return;
    var id = parseInt(options.id) || 1;
    if (id === 9) {
      this.handleMbtiResult(options);
      return;
    }
    var score = parseInt(options.score) || 20;
    var total = parseInt(options.total) || 20;
    var percentage = Math.round((score / (total * 4)) * 100);
    var stdScore = percentage;
    var key = scaleKeys[id] || "sas";
    var resultData = resultsData[key];
    var level = "", levelColor = "", levelDesc = "";
    var ranges = resultData.ranges;
    for (var i = 0; i < ranges.length; i++) {
      if (score >= ranges[i].min && score <= ranges[i].max) {
        level = ranges[i].level; levelColor = ranges[i].levelColor; levelDesc = ranges[i].levelDesc; break;
      }
    }
    if (!level) { level = ranges[0].level; levelColor = ranges[0].levelColor; levelDesc = ranges[0].levelDesc; }
    var analysis = resultData.analysis[level] || "请参考测评结果。";
    var suggestions = resultData.suggestions[level] || [];

    // 生成五维得分（基于总分和测评类型模拟各维度分数）
    var dimensions = this.generateDimensions(id, score, total);

    // 仅在新提交时保存结果；查看历史记录时不重复写入
    var currentResults = wx.getStorageSync("assessmentResults") || [];
    if (options.readonly !== "1") {
      var user = wx.getStorageSync("userInfo") || {};
      currentResults.push({
        id: Date.now(), studentId: user.studentId || "demo-student", taskId: parseInt(options.taskId) || 0,
        assessmentId: id, assessmentName: resultData.name,
        score: score, total: total, stdScore: stdScore, level: level, riskLevel: this.mapRiskLevel(level), dimensions: dimensions,
        date: new Date().toISOString().slice(0, 10)
      });
      wx.setStorageSync("assessmentResults", currentResults);
    }

    this.setData({
      score: score, total: total, percentage: percentage, stdScore: stdScore,
      level: level, levelColor: levelColor, levelDesc: levelDesc,
      analysis: analysis, suggestions: suggestions,
      assessmentName: resultData.name, assessmentId: id,
      dimensions: dimensions,
      historyCount: currentResults.filter(function(r) { return r.assessmentId === id; }).length
    });

    // 延迟绘制雷达图（等 canvas 渲染完成）
    var that = this;
    setTimeout(function() { that.drawRadar(); }, 300);
  },

  /* 根据测评类型模拟生成五维得分 */
  generateDimensions: function(assessmentId, totalScore, maxScore) {
    var basePercent = (totalScore / (maxScore * 4) * 100);
    // 不同测评类型各维度权重不同
    var weights = {
      1: [1.3, 1.1, 0.9, 0.7, 1.0], // SAS情绪压力量表 -> 情绪和压力高
      2: [1.2, 0.9, 1.0, 0.8, 1.1], // SDS心境状态量表 -> 情绪和自我价值高
      3: [0.8, 1.4, 0.9, 0.7, 1.0], // 学业压力 -> 压力高
      4: [0.7, 0.8, 0.6, 1.5, 1.1], // 人际 -> 人际高
      5: [1.4, 0.9, 0.7, 0.8, 0.8], // 情绪调节 -> 情绪高
      6: [0.6, 0.7, 0.6, 0.8, 1.5], // 自尊 -> 自我价值高
      7: [0.8, 1.0, 1.4, 0.6, 0.7], // 睡眠 -> 睡眠高
      8: [0.9, 1.1, 0.7, 0.8, 1.2]  // 韧性
    };
    var w = weights[assessmentId] || [1.0, 1.0, 1.0, 1.0, 1.0];
    return RADAR_DIMENSIONS.map(function(dim, i) {
      var val = Math.round(basePercent * w[i]);
      var deterministicOffset = ((assessmentId * 7 + i * 3) % 9) - 4;
      val = Math.max(10, Math.min(100, val + deterministicOffset));
      return { label: dim.label, value: val, max: 100 };
    });
  },

  mapRiskLevel: function(level) {
    if (/过高|严重|困难|较低/.test(level)) return "较高风险";
    if (/偏高|较高|中度|轻微|一般|偏低/.test(level)) return "关注";
    return "正常";
  },

  /* Canvas 绘制五维雷达图 */
  drawRadar: function() {
    var query = wx.createSelectorQuery();
    var that = this;
    query.select("#radarCanvas")
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0]) return;
        var canvas = res[0].node;
        var ctx = canvas.getContext("2d");
        var width = res[0].width;
        var height = res[0].height;
        var dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        var dims = that.data.dimensions;
        if (dims.length < 3) return;

        var cx = width / 2, cy = height / 2;
        var radius = Math.min(cx, cy) - 30;
        var count = dims.length;
        var angleStep = (2 * Math.PI) / count;

        // 绘制背景网格（5层）
        for (var g = 1; g <= 5; g++) {
          ctx.beginPath();
          var r = (radius * g) / 5;
          for (var i = 0; i <= count; i++) {
            var a = -Math.PI / 2 + angleStep * i;
            var x = cx + r * Math.cos(a);
            var y = cy + r * Math.sin(a);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = "#eee";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // 绘制轴线
        for (var i = 0; i < count; i++) {
          var a = -Math.PI / 2 + angleStep * i;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
          ctx.strokeStyle = "#ddd";
          ctx.stroke();
        }

        // 绘制数据区域
        ctx.beginPath();
        for (var i = 0; i < count; i++) {
          var val = dims[i].value / 100;
          var a = -Math.PI / 2 + angleStep * i;
          var x = cx + radius * val * Math.cos(a);
          var y = cy + radius * val * Math.sin(a);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = that.data.levelColor + "30";
        ctx.fill();
        ctx.strokeStyle = that.data.levelColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制数据点
        for (var i = 0; i < count; i++) {
          var val = dims[i].value / 100;
          var a = -Math.PI / 2 + angleStep * i;
          var x = cx + radius * val * Math.cos(a);
          var y = cy + radius * val * Math.sin(a);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = that.data.levelColor;
          ctx.fill();
        }

        // 绘制标签
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        for (var i = 0; i < count; i++) {
          var a = -Math.PI / 2 + angleStep * i;
          var lx = cx + (radius + 20) * Math.cos(a);
          var ly = cy + (radius + 20) * Math.sin(a);
          ctx.fillText(dims[i].label, lx, ly);
        }
      });
  },

  /* MBTI结果处理 */
  handleMbtiResult: function(options) {
    var mbti = require("../../utils/mbti");
    var type = options.type || "ISTJ";
    var scores = {};
    try { scores = JSON.parse(options.scores || "{}"); } catch(e) {}
    var result = mbti.MBTI_RESULTS[type] || mbti.MBTI_RESULTS["ISTJ"];
    var dims = [];
    var dimOrder = ["EI", "SN", "TF", "JP"];
    for (var i = 0; i < dimOrder.length; i++) {
      var d = dimOrder[i];
      var info = mbti.MBTI_DIMENSIONS[d];
      dims.push({
        label: info.left + "/" + info.right,
        leftPct: scores[type[0]] || 50,
        rightPct: scores[type[1]] || 50
      });
    }
    this.setData({
      score: 0, total: 28, percentage: 100, stdScore: 0,
      level: result.name, levelColor: result.color, levelDesc: result.title,
      analysis: result.description, suggestions: ["优势特质：" + result.strengths, "适合职业方向：" + result.careers],
      assessmentName: "MBTI人格类型测试", assessmentId: 9,
      mbtiType: type, dims: dims,
      historyCount: 0
    });
  },

  /* 查看历史趋势 */
  viewHistory: function() {
    wx.navigateTo({
      url: "/pages/assessment/history?id=" + this.data.assessmentId
    });
  },

  goHelp: function() { wx.navigateTo({ url: "/pages/help/index" }); },

  goBack: function() { wx.navigateBack(); },
  onShare: function() {}
});
