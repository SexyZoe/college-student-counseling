/* Browser-only student UI. No WeChat SDK and no external CDN requests. */
(function () {
  "use strict";
  let catalog;
  let catalogUser;
  let activeDraft;
  let submitting = false;
  const C = () => window.Campus;
  const el = id => document.getElementById(id);
  const date = value => new Date(value).toLocaleString("zh-CN", { hour12: false });
  const button = (text, route, secondary = false) => `<button class="button ${secondary ? "secondary" : "primary"}" data-route="${C().h(route)}">${C().h(text)}</button>`;
  function links() { document.querySelectorAll("[data-route]").forEach(node => node.onclick = () => C().navigate(node.dataset.route)); }
  function set(html) { C().view().innerHTML = html; links(); }
  function draftKey(id, task) { return `campus:${C().state.user.id}:draft:${id}:${task || "self"}`; }
  function read(key) { try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch (_) { return null; } }
  function save(draft) {
    draft.updatedAt = Date.now();
    try { sessionStorage.setItem(draft.key, JSON.stringify(draft)); return true; }
    catch (_) { C().notice("浏览器无法保存草稿，请勿关闭或刷新本页", true); return false; }
  }
  function newId() {
    if (globalThis.crypto?.randomUUID) return "web:" + crypto.randomUUID();
    if (globalThis.crypto?.getRandomValues) return "web:" + Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join("");
    return "web:" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2);
  }
  async function getCatalog() {
    if (!catalog || catalogUser !== C().state.user.id) { catalog = await C().api("/api/v1/student/catalog"); catalogUser = C().state.user.id; }
    return catalog;
  }
  async function render(route) {
    activeDraft = null;
    await getCatalog();
    const [page, id, encodedTask] = route.split("/");
    const task = encodedTask ? decodeURIComponent(encodedTask) : "";
    if (page === "dashboard") return dashboard();
    if (page === "assessments") return assessments();
    if (page === "quiz") return quiz(Number(id), task);
    if (page === "history") return history();
    if (page === "result") return result(id);
    if (page === "reading" || page === "civics") return reading(page);
    if (page === "faq") return faq();
    if (page === "help") return help();
    if (page === "privacy") return privacy();
    if (page === "personality") return personality(id === "quiz");
    set('<section class="card"><h2>页面不存在</h2>' + button("回到首页", "dashboard") + '</section>');
  }
  async function dashboard() {
    const { api, state, h } = C();
    const [tasks, results] = await Promise.all([api("/api/v1/assessment-tasks"), api("/api/v1/assessment-results/me")]);
    const done = new Set(results.map(r => String(r.taskId)));
    const pending = tasks.filter(t => t.status === "进行中" && !done.has(String(t.id)));
    set(`<section class="student-hero"><span class="eyebrow">留一点时间给自己</span><h2>你好，${h(state.user.displayName)}。</h2><p>不必急着给情绪一个答案。觉察、理解，然后慢慢向前。</p><div class="actions">${button("了解近期状态", "assessments")}${button("寻找支持", "help", true)}</div></section><div class="grid two spaced"><section class="card"><h2>我的测评任务</h2>${pending.length ? pending.map(t => `<div class="list-row"><div><strong>${h(t.title)}</strong><p class="hint">截止 ${h(t.deadline)}</p></div>${button("开始", `quiz/${t.assessmentId}/${encodeURIComponent(t.id)}`)}</div>`).join("") : '<p class="empty">目前没有待完成的测评任务。</p>'}</section><section class="card"><h2>你的成长记录</h2><p>已保存 <strong>${results.length}</strong> 次测评记录。</p><p class="hint">结果帮助你理解近期状态，不代表医学诊断。</p>${button("查看记录", "history", true)}</section></div><div class="grid three spaced"><section class="card"><h3>给情绪一点空间</h3><p>阅读学校发布的心理科普内容。</p>${button("阅读科普", "reading", true)}</section><section class="card"><h3>认识自己的偏好</h3><p>人格探索独立于心理健康筛查。</p>${button("开始探索", "personality", true)}</section><section class="card"><h3>遇到困扰时</h3><p>找到常见问题的解答和支持渠道。</p>${button("看看常见问题", "faq", true)}</section></div>`);
  }
  async function assessments() {
    const { h, api, badge } = C();
    const [tasks, results] = await Promise.all([api("/api/v1/assessment-tasks"), api("/api/v1/assessment-results/me")]);
    const done = new Set(results.map(r => String(r.taskId)));
    set(`<section class="card"><h2>学校安排的任务</h2>${tasks.length ? tasks.map(t => `<div class="list-row"><div><strong>${h(t.title)}</strong><p class="hint">截止 ${h(t.deadline)} · ${h(t.status)} ${done.has(String(t.id)) ? badge("已完成") : ""}</p></div>${t.status === "进行中" && !done.has(String(t.id)) ? button("开始答题", `quiz/${t.assessmentId}/${encodeURIComponent(t.id)}`) : ""}</div>`).join("") : '<p class="hint">当前没有测评任务。</p>'}</section><h2 class="spaced">自主了解近期状态</h2><p class="hint">请按自己的需要选择。测评结果仅用于自我了解和学校支持。</p><div class="grid two">${catalog.assessments.map(a => `<article class="card"><span class="badge">${h(a.category)}</span><h3>${h(a.name)}</h3><p>${h(a.description)}</p><p class="hint">${a.questions.length} 道题 · 约 ${a.duration} 分钟</p>${button("开始测评", `quiz/${a.id}`)}</article>`).join("")}</div>`);
  }
  function privacyText() {
    const { state, h } = C(); const site = state.site || {};
    return `<div class="article-body"><p>本平台用于心理健康教育、状态自评和必要的学校支持，不提供医疗诊断，也不替代线下心理咨询或紧急救助。</p><p>提交测评将向学校系统保存你的身份、班级、答案、评分结果、问卷版本和提交时间。心理测评信息属于需要严格保护的信息；你的授权辅导员可查看必要的结果摘要并开展人工跟进，不在辅导员页面展示原始答案。</p><p>测评记录不得用于公开排名、处分或无关评价。人格探索结果不上传到心理风险系统。</p><p>保存期限与处理规则：${h(site.retentionNotice || "由学校在正式运行前明确告知")}。</p><p>如需查询、更正、删除信息或撤回授权，请联系：${h(site.privacyContact || "学校负责本系统的老师（具体渠道待学校确认）")}。停止答题不会新增提交；已提交记录的处理由学校依适用规则办理。</p><p>未提交的草稿只保留在当前浏览器标签页会话中，24小时后失效；退出登录会清除。请勿在共用设备上保留登录状态。</p><p>隐私说明版本：${h(catalog.consentVersion)}</p></div>`;
  }
  async function quiz(id, taskId) {
    const { api, h } = C();
    const assessment = catalog.assessments.find(a => a.id === id);
    if (!assessment) throw new Error("测评不存在");
    if (taskId) {
      const tasks = await api("/api/v1/assessment-tasks");
      const task = tasks.find(t => String(t.id) === taskId);
      if (!task || task.assessmentId !== id || task.status !== "进行中") throw new Error("该测评任务当前不可填写");
      if (task.questionnaireVersion !== assessment.questionnaireVersion || task.scoringVersion !== assessment.scoringVersion) throw new Error("该任务的问卷版本暂不支持，请联系管理员");
    }
    const key = draftKey(id, taskId); let draft = read(key);
    if (!draft || Date.now() - draft.updatedAt > 86400000 || draft.questionnaireVersion !== assessment.questionnaireVersion || draft.scoringVersion !== assessment.scoringVersion || draft.consentVersion !== catalog.consentVersion) {
      draft = { key, assessmentId: id, taskId, answers: {}, index: 0, submissionId: newId(), questionnaireVersion: assessment.questionnaireVersion, scoringVersion: assessment.scoringVersion, consentVersion: catalog.consentVersion, consent: false, updatedAt: Date.now() };
      sessionStorage.removeItem(key);
    }
    activeDraft = draft;
    if (!draft.consent) {
      set(`<section class="card narrow"><span class="eyebrow">开始之前</span><h2>${h(assessment.name)}</h2>${privacyText()}<label class="check-line"><input type="checkbox" id="assessment-consent">我已阅读，并单独同意为上述目的处理本次心理测评信息。</label><div class="actions"><button id="start-quiz" class="button primary" disabled>同意并开始</button>${button("暂不测评", "assessments", true)}</div></section>`);
      el("assessment-consent").onchange = e => el("start-quiz").disabled = !e.target.checked;
      el("start-quiz").onclick = () => { draft.consent = true; save(draft); question(assessment, draft); };
      return;
    }
    question(assessment, draft);
  }
  function question(assessment, draft) {
    if (C().state.view.split("/")[0] !== "quiz") return;
    const { h } = C(); const total = assessment.questions.length;
    draft.index = Math.max(0, Math.min(Number(draft.index) || 0, total - 1));
    const q = assessment.questions[draft.index]; const count = Object.keys(draft.answers).length;
    set(`<section class="card narrow quiz-card"><div class="section-title"><span class="badge">${h(assessment.name)}</span><span>${draft.index + 1} / ${total}</span></div><progress class="quiz-progress" value="${count}" max="${total}" aria-label="答题进度"></progress><p class="hint">已回答 ${count} 题 · 草稿仅保存在本标签页</p><fieldset class="question"><legend>${h(q.title)}</legend>${q.options.map((o, i) => `<label class="answer-option ${draft.answers[draft.index] === i ? "selected" : ""}"><input type="radio" name="answer" value="${i}" ${draft.answers[draft.index] === i ? "checked" : ""} ${draft.pending ? "disabled" : ""}><span>${h(o.label)}. ${h(o.text)}</span></label>`).join("")}</fieldset><div class="actions"><button class="button secondary" id="previous" ${draft.index === 0 ? "disabled" : ""}>上一题</button><button class="button primary" id="next">${draft.index === total - 1 ? "检查并提交" : "下一题"}</button></div><div class="question-jumps" aria-label="题号导航">${assessment.questions.map((_, i) => `<button class="jump ${draft.answers[i] !== undefined ? "answered" : ""}" data-index="${i}" aria-label="第${i + 1}题${draft.answers[i] !== undefined ? '已答' : '未答'}" ${i === draft.index ? 'aria-current="step"' : ''}>${i + 1}</button>`).join("")}</div><p id="submit-status" role="status">${draft.pending ? "上次提交尚未确认，请重试提交；系统会防止重复入库。" : ""}</p><div class="actions">${button("稍后继续", "assessments", true)}<button id="discard" class="button secondary">放弃本次草稿</button></div></section>`);
    document.querySelectorAll('input[name="answer"]').forEach(input => input.onchange = () => { draft.answers[draft.index] = Number(input.value); save(draft); question(assessment, draft); });
    el("previous").onclick = () => { draft.index--; save(draft); question(assessment, draft); };
    el("next").onclick = () => {
      if (draft.index === total - 1) return submit(assessment, draft);
      if (draft.answers[draft.index] === undefined) return C().notice("请先选择本题答案", true);
      draft.index++; save(draft); question(assessment, draft); el("view").scrollIntoView({ block: "start" });
    };
    document.querySelectorAll("[data-index]").forEach(b => b.onclick = () => { draft.index = Number(b.dataset.index); save(draft); question(assessment, draft); });
    el("discard").onclick = () => { if (confirm("确认清除本次未完成的答案？")) { sessionStorage.removeItem(draft.key); activeDraft = null; C().navigate("assessments"); } };
  }
  async function submit(assessment, draft) {
    if (submitting) return;
    const missing = assessment.questions.findIndex((_, i) => draft.answers[i] === undefined);
    if (missing !== -1) { draft.index = missing; question(assessment, draft); C().notice("还有未回答的题目，请先补齐", true); return; }
    if (!draft.pending && !confirm("确认提交本次答案？提交后将保存到学校系统。")) return;
    draft.pending = true; save(draft); submitting = true;
    document.querySelectorAll(".quiz-card input, .quiz-card button").forEach(node=>node.disabled=true);
    const next = el("next"); if (next) { next.textContent = "正在提交…"; }
    try {
      const data = await C().api("/api/v1/student/submissions", { method: "POST", body: JSON.stringify(draft) });
      sessionStorage.removeItem(draft.key); activeDraft = null;
      C().notice("测评已保存"); C().navigate(`result/${data.result.id}`);
    } catch (error) {
      if (error.status && error.status < 500 && error.status !== 429) { draft.pending = false; save(draft); }
      C().notice(error.message, true);
      question(assessment, draft);
      if (el("submit-status")) el("submit-status").textContent = "尚未确认保存。请保持本页，连接校园网后点击重试；不会重复记录。";
      if (el("next")) { el("next").disabled = false; el("next").textContent = "重试提交"; }
    } finally { submitting = false; }
  }
  async function history() {
    const { api, h, badge } = C(); const results = await api("/api/v1/assessment-results/me");
    set(`<section class="card"><h2>我的测评记录</h2><label>按量表查看<select id="history-filter"><option value="">全部量表</option>${catalog.assessments.map(a => `<option value="${a.id}">${h(a.name)}</option>`).join("")}</select></label><div id="history-items"></div></section>`);
    const draw = () => {
      const selected = el("history-filter").value; const rows = results.filter(r => !selected || String(r.assessmentId) === selected);
      el("history-items").innerHTML = rows.length ? rows.map(r => `<div class="list-row"><div><strong>${h(r.assessmentName)}</strong><p>${badge(r.riskLevel)} <span class="hint">${h(date(r.createdAt))} · ${h(r.semesterId)}</span></p></div>${button("查看结果", `result/${r.id}`, true)}</div>`).join("") : '<p class="empty">暂无记录。</p>';
      if (selected && rows.length > 1) el("history-items").insertAdjacentHTML("afterbegin", `<div class="trend"><h3>同一量表的历史变化</h3>${rows.slice(0, 10).reverse().map(r => `<div class="trend-row"><span>${h(new Date(r.createdAt).toLocaleDateString("zh-CN"))}</span><progress max="100" value="${r.stdScore}" aria-label="状态指数 ${r.stdScore}"></progress><b>${r.stdScore}</b></div>`).join("")}<p class="hint">不同版本的结果需谨慎比较；指数不能替代专业评估。</p></div>`);
      links();
    }; el("history-filter").onchange = draw; draw();
  }
  async function result(id) {
    const { api, h, badge } = C(); const results = await api("/api/v1/assessment-results/me"); const r = results.find(x => String(x.id) === id);
    if (!r) throw new Error("结果不存在或不属于当前账号");
    const needSupport = r.riskLevel !== "正常";
    set(`<section class="card narrow result-card"><span class="eyebrow">本次状态记录</span><h2>${h(r.assessmentName)}</h2>${badge(r.riskLevel)}<div class="result-number">${r.stdScore}<small>/ 100 状态指数</small></div><p>${needSupport ? "你的回答提示近期可能有需要关注的困扰。可以和学校心理老师讨论，获得适合你的支持。" : "本次回答未达到当前规则的关注阈值。如果你仍感到困扰，也可以主动寻求支持。"}</p><p class="hint">这是辅助筛查结果，不是医学诊断。状态指数越高表示按本套规则评估的状态越好。</p>${r.triggeredRules.length ? '<p class="support-callout">本次回答触发了需要人工关注的条目。若正面临紧急危险，请直接寻求现场帮助，不要等待平台响应。</p>' : ''}<dl class="result-meta"><dt>提交时间</dt><dd>${h(date(r.createdAt))}</dd><dt>学期</dt><dd>${h(r.semesterId)}</dd><dt>问卷 / 评分版本</dt><dd>${h(r.questionnaireVersion)} / ${h(r.scoringVersion)}</dd></dl><div class="actions">${button("寻找支持", "help")}${button("全部记录", "history", true)}</div></section>`);
  }
  async function reading(page) {
    const { api, h, mediaHtml } = C(); const type = page === "civics" ? "civics" : "psychoeducation";
    const items = await api(`/api/v1/content-items?type=${type}`);
    const favoriteKey=`campus-favorites:${C().state.user.id}`;
    let favorites;try{favorites=JSON.parse(localStorage.getItem(favoriteKey)||"[]");if(!Array.isArray(favorites))favorites=[]}catch(_){favorites=[]}
    set(`<section class="card"><label>搜索文章<input type="search" id="article-search" placeholder="输入标题或关键词"></label><label class="check-line"><input type="checkbox" id="favorites-only">只看我的收藏</label></section><div class="grid two spaced" id="article-items"></div>`);
    const draw = () => { const key = el("article-search").value.trim().toLowerCase(); el("article-items").innerHTML = items.filter(x => `${x.title} ${x.summary} ${x.category}`.toLowerCase().includes(key) && (!el("favorites-only").checked || favorites.includes(x.id))).map(x => `<article class="card"><span class="badge">${h(x.category)}</span><h2>${h(x.title)}</h2><p class="hint">${h(x.authorName)} · ${h(date(x.publishTime || x.createdAt))}</p><p>${h(x.summary)}</p>${mediaHtml(x.media)}<button class="button secondary favorite-article" data-id="${x.id}" aria-pressed="${favorites.includes(x.id)}">${favorites.includes(x.id)?"取消收藏":"收藏"}</button><details><summary>阅读全文</summary><div class="article-body">${h(x.content)}</div></details></article>`).join("") || '<section class="card empty">暂时没有符合条件的已发布文章。</section>'; ;document.querySelectorAll(".favorite-article").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.id);favorites=favorites.includes(id)?favorites.filter(x=>x!==id):favorites.concat(id);try{localStorage.setItem(favoriteKey,JSON.stringify(favorites))}catch(_){C().notice("收藏暂时无法保存",true)}draw()}); }; el("article-search").oninput = draw;el("favorites-only").onchange=draw; draw();
  }
  function faq() {
    const { h } = C(); set('<section class="card"><label>搜索常见问题<input id="faq-search" type="search" placeholder="例如：考试、睡眠、人际关系"></label><div id="faq-items"></div></section>');
    const draw = () => { const key = el("faq-search").value.trim(); el("faq-items").innerHTML = catalog.faq.filter(x => `${x.question}${x.answer}${x.category}`.includes(key)).map(x => `<details class="faq-item"><summary>${h(x.question)}</summary><p class="article-body">${h(x.answer)}</p></details>`).join("") || '<p class="empty">没有匹配的问题，可联系学校心理老师。</p>'; }; el("faq-search").oninput = draw; draw();
  }
  function help() {
    const { h, state } = C(); const site = state.site || {}; const phone = String(site.supportPhone || "").replace(/[^\d+\-]/g, "");
    set(`<section class="student-hero"><span class="eyebrow">你不必独自面对</span><h2>和可以支持你的人联系。</h2><p>如果你或身边的人面临紧急危险，请立即联系现场人员或拨打紧急电话。平台不提供实时值守。</p></section><div class="grid two spaced"><section class="card"><h2>学校心理支持</h2><p>${h(site.supportLocation || "请向辅导员了解心理咨询中心的位置和预约方式。")}</p><p>${h(site.supportHours || "服务时间待学校确认")}</p>${phone ? `<a class="button primary" href="tel:${phone}">联系心理中心 ${h(site.supportPhone)}</a>` : '<p class="hint">学校联系电话尚未配置。</p>'}</section><section class="card"><h2>紧急帮助</h2><div class="actions"><a class="button primary" href="tel:120">医疗急救 120</a><a class="button secondary" href="tel:110">公安报警 110</a></div><p class="hint">同时联系身边可信赖的人，尽量不要独处。</p></section></div>`);
  }
  function privacy() { set(`<section class="card narrow"><h2>关于你的信息</h2>${privacyText()}${button("返回首页", "dashboard", true)}</section>`); }
  function personality(start) {
    const { h } = C(); const p = window.Personality;
    if (!start) { set(`<section class="student-hero"><span class="eyebrow">认识自己的另一种方式</span><h2>人格探索</h2><p>28 道题，了解你在沟通、学习和做决定时的偏好。</p><p>结果仅供趣味探索，不是临床测评，不参与心理风险判断，也不会上传给辅导员。</p>${button("开始探索", "personality/quiz")}</section>`); return; }
    let answers = {}, index = 0;
    const draw = () => {
      const q = p.MBTI_QUESTIONS[index]; set(`<section class="card narrow"><span class="badge">人格探索 · ${index + 1} / ${p.MBTI_QUESTIONS.length}</span><h2>${h(q.title)}</h2>${q.options.map((o, i) => `<button class="answer-option personality-option" data-choice="${i}">${h(o.text)}</button>`).join("")}<button class="button secondary" id="personality-back" ${index === 0 ? "disabled" : ""}>上一题</button></section>`);
      el("personality-back").onclick = () => { index--; draw(); };
      document.querySelectorAll("[data-choice]").forEach(b => b.onclick = () => { answers[index] = Number(b.dataset.choice); if (++index < p.MBTI_QUESTIONS.length) return draw(); const outcome = p.calculateType(answers); const r = outcome.result;
        set(`<section class="card narrow"><span class="eyebrow">探索结果</span><h2>${h(outcome.type)} · ${h(r.name || r.title || "")}</h2><p class="article-body">${h(r.description || r.desc || "这是一份关于个人偏好的探索结果。")}</p><div class="grid two">${Object.entries(p.MBTI_DIMENSIONS).map(([key, d]) => `<div><h3>${h(d.left)} / ${h(d.right)}</h3><p>${outcome.scores[key[0]]} / ${outcome.scores[key[1]]}</p></div>`).join("")}</div><p class="hint">人格偏好可能随情境改变，这个结果不会定义你，也未上传到学校系统。</p>${button("返回首页", "dashboard")}</section>`);
      });
    }; draw();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && activeDraft) save(activeDraft); });
  window.addEventListener("pagehide", () => { if (activeDraft) save(activeDraft); });
  window.StudentApp = { render };
})();
