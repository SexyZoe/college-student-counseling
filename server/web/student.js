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
    if (page === "reading" || page === "civics") return reading(page, id === "favorites");
    if (page === "faq") return faq();
    if (page === "help") return help();
    if (page === "privacy") return privacy();
    if (page === "personality") return personality(id === "quiz");
    set('<section class="card"><h2>页面不存在</h2>' + button("回到首页", "dashboard") + '</section>');
  }
  async function dashboard() {
    const { api, state, h } = C();
    const renderEpoch = state.epoch;
    const [tasks, results] = await Promise.all([api("/api/v1/assessment-tasks"), api("/api/v1/assessment-results/me")]);
    const [semesterResponse, articleResponse, civicsResponse] = await Promise.allSettled([
      api("/api/v1/semesters/current"),
      api("/api/v1/content-items?type=psychoeducation"),
      api("/api/v1/content-items?type=civics")
    ]);
    if (state.epoch !== renderEpoch || state.view !== "dashboard") return;
    const semester = semesterResponse.status === "fulfilled" ? semesterResponse.value : null;
    const articles = articleResponse.status === "fulfilled" ? articleResponse.value.slice(0, 3) : [];
    const civics = civicsResponse.status === "fulfilled" ? civicsResponse.value.slice(0, 2) : [];
    const done = new Set(results.map(r => String(r.taskId)));
    const pending = tasks.filter(t => t.status === "进行中" && !done.has(String(t.id)));
    const latest = results[0];
    const quick = [["✎","心理测评","assessments","pink"],["▤","心理资讯","reading","yellow"],["?","常见问题","faq","lavender"],["☺","人格探索","personality","peach"],["♡","成长与价值","civics","sky"],["☎","求助支持","help","mint"]];
    const banners = [["banner_1.png","关注心理健康，从了解自己开始","assessments"],["banner_2.png","科学心理测评，助力自我成长","assessments"],["banner_3.png","每日心理科普，守护心灵港湾","reading"]];
    set(`<div class="mini-home"><header class="mini-home-head"><div><h2>你好，${h(state.user.displayName || "同学")}。</h2><p>今天心情如何？</p></div><button class="mini-avatar" data-route="account" aria-label="我的账号"><img src="/web/images/avatars/avatar_1.png" alt=""></button></header>
      <div class="mini-banner-track" aria-label="校园心理健康轮播图">${banners.map(([image,title,route])=>`<button class="mini-banner" data-route="${route}" aria-label="${title}"><img src="/web/images/banners/${image}" alt="${title}"></button>`).join("")}</div>
      <div class="mini-home-body"><section class="mini-info-card"><div class="mini-info-row"><span class="mini-info-icon mint">▤</span><div><small>当前学期</small><strong>${h(semester?.name || "未配置学期")}</strong></div></div><div class="mini-info-row"><span class="mini-info-icon sky">⌂</span><div><small>班级信息</small><strong>${h(state.user.className || "暂未分配班级")}</strong></div></div></section>
      <section class="mini-section"><div class="mini-section-head"><h2>待完成测评</h2><span>${pending.length ? pending.length + "项" : ""}</span></div>${pending.length ? pending.map(t=>`<button class="mini-task-row" data-route="quiz/${t.assessmentId}/${encodeURIComponent(t.id)}"><span class="mini-task-stripe"></span><span><strong>${h(t.title)}</strong><small>截止：${h(t.deadline)} · ${h(t.status)}</small></span><b aria-hidden="true">›</b></button>`).join("") : '<p class="mini-empty">✓<small>当前没有待完成的测评任务</small></p>'}</section>
      ${latest ? `<section class="mini-section"><div class="mini-section-head"><h2>最近测评结果</h2><button data-route="history">共${results.length}条 ›</button></div><button class="mini-result-row" data-route="result/${h(latest.id)}"><span><strong>${h(latest.assessmentName)}</strong><small>${h(date(latest.createdAt))}</small></span><span class="mini-score-ring">${h(latest.stdScore)}<small>幸福指数</small></span></button></section>` : ""}
      <section class="mini-section"><div class="mini-section-head"><h2>核心服务</h2></div><div class="mini-entry-grid">${quick.map(([icon,label,route,color])=>`<button data-route="${route}"><span class="mini-entry-icon ${color}">${icon}</span><span>${label}</span></button>`).join("")}</div></section>
      ${civics.length ? `<section class="mini-section"><div class="mini-section-head"><h2>成长与价值</h2><button data-route="civics">更多 ›</button></div>${civics.map(x=>`<button class="mini-text-row" data-route="civics"><span><small>${h(x.category)}</small><strong>${h(x.title)}</strong><em>${h(x.summary)}</em></span><b>›</b></button>`).join("")}</section>` : ""}
      <section class="mini-section"><div class="mini-section-head"><h2>每日心理资讯</h2><button data-route="reading">更多 ›</button></div>${articles.length ? articles.map((x,i)=>`<button class="mini-article-row" data-route="reading"><img src="${h(x.media?.find(m=>m.kind==="image")?.url || `/web/images/articles/${["article_growth.png","article_mood.png","article_stress.png"][i]}`)}" alt=""><span><small>${h(x.category)}</small><strong>${h(x.title)}</strong><em>${h(x.summary)}</em></span></button>`).join("") : '<p class="mini-empty"><small>学校尚未发布心理资讯</small></p>'}</section></div></div>`);
  }
  async function assessments() {
    const { h, api, badge } = C();
    const [tasks, results] = await Promise.all([api("/api/v1/assessment-tasks"), api("/api/v1/assessment-results/me")]);
    const done = new Set(results.map(r => String(r.taskId)));
    const categories = ["全部", ...new Set(catalog.assessments.map(a => a.category))];
    set(`<div class="mini-assessments"><div class="mini-category-list" role="tablist" aria-label="测评分类">${categories.map((name,i)=>`<button class="mini-category ${i===0?"active":""}" data-category="${h(name)}" role="tab" aria-selected="${i===0}">${h(name)}</button>`).join("")}</div>
      ${tasks.length ? `<section class="mini-section mini-assigned"><div class="mini-section-head"><h2>学校安排的任务</h2></div>${tasks.map(t=>`<div class="mini-task-row"><span class="mini-task-stripe"></span><span><strong>${h(t.title)}</strong><small>截止：${h(t.deadline)} · ${h(t.status)} ${done.has(String(t.id))?badge("已完成"):""}</small></span>${t.status==="进行中"&&!done.has(String(t.id))?button("开始",`quiz/${t.assessmentId}/${encodeURIComponent(t.id)}`):""}</div>`).join("")}</section>` : ""}
      <div class="mini-assessment-list" id="assessment-list"></div><p class="mini-assessment-tip">ⓘ 测评结果仅供参考，如有需要请咨询专业人士</p></div>`);
    const draw = category => {
      el("assessment-list").innerHTML = catalog.assessments.filter(a=>category==="全部"||a.category===category).map(a=>`<button class="mini-assessment-card" data-route="quiz/${a.id}"><span class="mini-assessment-head"><span class="mini-assessment-badge">${h(a.category)}</span><span><strong>${h(a.name)}</strong><small>${h(a.description)}</small></span></span><span class="mini-assessment-foot"><span>✎ ${a.questions.length}题</span><span>◷ ${a.duration}分钟</span><b>›</b></span></button>`).join("") || '<p class="mini-empty"><small>暂无此类测评</small></p>';
      links();
      document.querySelectorAll(".mini-category").forEach(tab=>{const active=tab.dataset.category===category;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",String(active))});
    };
    document.querySelectorAll(".mini-category").forEach(tab=>tab.onclick=()=>draw(tab.dataset.category));draw("全部");
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
    set(`<section class="card narrow quiz-card"><div class="mini-quiz-header"><div class="section-title"><span class="badge">${h(assessment.name)}</span><span>${draft.index + 1} / ${total}</span></div><progress class="quiz-progress" value="${draft.index + 1}" max="${total}" aria-label="答题进度"></progress><p class="hint">已回答 ${count} 题 · 草稿仅保存在本标签页</p></div><fieldset class="question"><legend><span class="mini-question-number">Q${draft.index + 1}</span>${h(q.title)}</legend>${q.options.map((o, i) => `<label class="answer-option ${draft.answers[draft.index] === i ? "selected" : ""}"><input type="radio" name="answer" value="${i}" ${draft.answers[draft.index] === i ? "checked" : ""} ${draft.pending ? "disabled" : ""}><span class="mini-option-label">${h(o.label)}</span><span>${h(o.text)}</span></label>`).join("")}</fieldset><div class="actions mini-quiz-actions"><button class="button secondary" id="previous" ${draft.index === 0 ? "disabled" : ""}>上一题</button><button class="button primary" id="next">${draft.index === total - 1 ? "检查并提交" : "下一题"}</button></div><div class="question-jumps" aria-label="题号导航">${assessment.questions.map((_, i) => `<button class="jump ${draft.answers[i] !== undefined ? "answered" : ""}" data-index="${i}" aria-label="第${i + 1}题${draft.answers[i] !== undefined ? '已答' : '未答'}" ${i === draft.index ? 'aria-current="step"' : ''}>${i + 1}</button>`).join("")}</div><p id="submit-status" role="status">${draft.pending ? "上次提交尚未确认，请重试提交；系统会防止重复入库。" : ""}</p><div class="actions mini-draft-actions">${button("稍后继续", "assessments", true)}<button id="discard" class="button secondary">放弃本次草稿</button></div></section>`);
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
    set(`<section class="card mini-history"><h2>我的测评记录</h2><label>按量表查看<select id="history-filter"><option value="">全部量表</option>${catalog.assessments.map(a => `<option value="${a.id}">${h(a.name)}</option>`).join("")}</select></label><div id="history-items"></div></section>`);
    const draw = () => {
      const selected = el("history-filter").value; const rows = results.filter(r => !selected || String(r.assessmentId) === selected);
      el("history-items").innerHTML = rows.length ? rows.map(r => `<div class="list-row mini-history-row"><div><strong>${h(r.assessmentName)}</strong><p>${badge(r.riskLevel)} <span class="hint">${h(date(r.createdAt))} · ${h(r.semesterId)}</span></p></div><span class="mini-history-score">${h(r.stdScore)}<small>幸福指数</small></span>${button("查看结果", `result/${r.id}`, true)}</div>`).join("") : '<p class="empty">暂无记录。</p>';
      if (selected && rows.length > 1) el("history-items").insertAdjacentHTML("afterbegin", `<div class="trend"><h3>同一量表的历史变化</h3>${rows.slice(0, 10).reverse().map(r => `<div class="trend-row"><span>${h(new Date(r.createdAt).toLocaleDateString("zh-CN"))}</span><progress max="100" value="${r.stdScore}" aria-label="状态指数 ${r.stdScore}"></progress><b>${r.stdScore}</b></div>`).join("")}<p class="hint">不同版本的结果需谨慎比较；指数不能替代专业评估。</p></div>`);
      links();
    }; el("history-filter").onchange = draw; draw();
  }
  async function result(id) {
    const { api, h, badge } = C(); const results = await api("/api/v1/assessment-results/me"); const r = results.find(x => String(x.id) === id);
    if (!r) throw new Error("结果不存在或不属于当前账号");
    const needSupport = r.riskLevel !== "正常";
    set(`<section class="card narrow result-card"><div class="mini-result-header"><h2>${h(r.assessmentName)}</h2><div class="mini-result-rings"><div class="mini-result-ring"><strong>${h(r.score)}</strong><small>/ ${h(r.total)} 原始分</small></div><div class="mini-result-ring wellbeing"><strong>${h(r.stdScore)}</strong><small>幸福指数</small></div></div><div class="mini-result-level">${badge(r.riskLevel)}</div><p>${needSupport ? "你的回答提示近期可能有需要关注的困扰。可以和学校心理老师讨论，获得适合你的支持。" : "本次回答未达到当前规则的关注阈值。如果你仍感到困扰，也可以主动寻求支持。"}</p></div><p class="mini-disclaimer">ⓘ 本结果仅用于心理健康教育和风险筛查参考，不构成医疗诊断。</p>${r.triggeredRules.length ? '<p class="support-callout">本次回答触发了需要人工关注的条目。若正面临紧急危险，请直接寻求现场帮助，不要等待平台响应。</p>' : ''}<div class="mini-result-section"><h3>测评分析</h3><p>${needSupport ? "建议结合近期生活状态，与学校心理老师讨论这些困扰。" : "幸福指数越高，表示按本套规则评估的状态越好。即使结果处于正常范围，感到困扰时仍可以主动寻求支持。"}</p></div><button class="mini-support-link" data-route="help"><span><strong>需要进一步支持？</strong><small>查看校心理中心和紧急求助渠道</small></span><b>›</b></button><div class="mini-result-section"><h3>记录信息</h3><dl class="result-meta"><dt>提交时间</dt><dd>${h(date(r.createdAt))}</dd><dt>学期</dt><dd>${h(r.semesterId)}</dd><dt>问卷 / 评分版本</dt><dd>${h(r.questionnaireVersion)} / ${h(r.scoringVersion)}</dd></dl></div><div class="actions mini-result-actions">${button("历史趋势", "history", true)}${button("返回测评", "assessments")}</div></section>`);
  }
  async function reading(page, showFavorites = false) {
    const { api, h, mediaHtml } = C(); const type = page === "civics" ? "civics" : "psychoeducation";
    const items = await api(`/api/v1/content-items?type=${type}`);
    const favoriteKey=`campus-favorites:${C().state.user.id}`;
    let favorites;try{favorites=JSON.parse(localStorage.getItem(favoriteKey)||"[]");if(!Array.isArray(favorites))favorites=[]}catch(_){favorites=[]}
    const categories = ["全部", ...new Set(items.map(x => x.category).filter(Boolean))];
    let category = "全部";
    set(`<div class="mini-reading"><div class="mini-category-list" role="tablist" aria-label="文章分类">${categories.map((name,i)=>`<button class="mini-category ${i===0?"active":""}" data-article-category="${h(name)}" role="tab" aria-selected="${i===0}">${h(name)}</button>`).join("")}</div><section class="mini-reading-tools"><label>搜索文章<input type="search" id="article-search" placeholder="输入标题或关键词"></label><label class="check-line"><input type="checkbox" id="favorites-only" ${showFavorites ? "checked" : ""}>只看我的收藏</label></section><div class="mini-reading-list" id="article-items"></div></div>`);
    const draw = () => { const key = el("article-search").value.trim().toLowerCase(); el("article-items").innerHTML = items.filter(x => (category === "全部" || x.category === category) && `${x.title} ${x.summary} ${x.category}`.toLowerCase().includes(key) && (!el("favorites-only").checked || favorites.includes(x.id))).map((x,i) => { const cover = x.media?.find(m => m.kind === "image")?.url || `/web/images/articles/${["article_growth.png","article_mood.png","article_stress.png"][i%3]}`; return `<article class="card mini-reading-card"><img class="mini-reading-cover" src="${h(cover)}" alt=""><div class="mini-reading-content"><span class="badge">${h(x.category)}</span><h2>${h(x.title)}</h2><p>${h(x.summary)}</p><p class="hint">${h(x.authorName)} · ${h(date(x.publishTime || x.createdAt))}</p><div class="mini-reading-actions"><button class="button secondary favorite-article" data-id="${x.id}" aria-pressed="${favorites.includes(x.id)}">${favorites.includes(x.id)?"取消收藏":"收藏"}</button><details><summary>阅读全文</summary><div class="article-body">${h(x.content)}${mediaHtml(x.media)}</div></details></div></div></article>` }).join("") || '<section class="card empty">暂时没有符合条件的已发布文章。</section>'; document.querySelectorAll(".favorite-article").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.id);favorites=favorites.includes(id)?favorites.filter(x=>x!==id):favorites.concat(id);try{localStorage.setItem(favoriteKey,JSON.stringify(favorites))}catch(_){C().notice("收藏暂时无法保存",true)}draw()}); }; el("article-search").oninput = draw;el("favorites-only").onchange=draw;document.querySelectorAll("[data-article-category]").forEach(tab=>tab.onclick=()=>{category=tab.dataset.articleCategory;document.querySelectorAll("[data-article-category]").forEach(x=>{const active=x.dataset.articleCategory===category;x.classList.toggle("active",active);x.setAttribute("aria-selected",String(active))});draw()});draw();
  }
  function faq() {
    const { h } = C(); const categories = ["全部", ...new Set(catalog.faq.map(x => x.category).filter(Boolean))]; let category = "全部";
    set(`<div class="mini-faq"><section class="mini-faq-search"><label>搜索常见问题<input id="faq-search" type="search" placeholder="搜索问题或关键词..."></label></section><div class="mini-category-list" role="tablist" aria-label="问题分类">${categories.map((name,i)=>`<button class="mini-category ${i===0?"active":""}" data-faq-category="${h(name)}" role="tab" aria-selected="${i===0}">${h(name)}</button>`).join("")}</div><div id="faq-items" class="mini-faq-list"></div><p class="mini-faq-footer">以上内容仅供参考，不能替代专业心理咨询</p></div>`);
    const draw = () => { const key = el("faq-search").value.trim(); el("faq-items").innerHTML = catalog.faq.filter(x => (category === "全部" || x.category === category) && `${x.question}${x.answer}${x.category}`.includes(key)).map(x => `<details class="faq-item"><summary><span><small>${h(x.category)}</small><strong>${h(x.question)}</strong></span><b aria-hidden="true">›</b></summary><p class="article-body">${h(x.answer)}</p></details>`).join("") || '<p class="empty">没有匹配的问题，可联系学校心理老师。</p>'; }; el("faq-search").oninput = draw; document.querySelectorAll("[data-faq-category]").forEach(tab=>tab.onclick=()=>{category=tab.dataset.faqCategory;document.querySelectorAll("[data-faq-category]").forEach(x=>{const active=x.dataset.faqCategory===category;x.classList.toggle("active",active);x.setAttribute("aria-selected",String(active))});draw()});draw();
  }
  function help() {
    const { h, state } = C(); const site = state.site || {}; const phone = String(site.supportPhone || "").replace(/[^\d+\-]/g, "");
    set(`<div class="mini-help"><section class="mini-urgent"><h2>如果你或身边的人正处于即时危险中</h2><p>请不要独自处理。尽快联系可信任的老师、家人、学校心理中心，并在紧急情况下拨打 110 或 120。</p></section><h2 class="mini-help-title">校内与紧急资源</h2><section class="mini-resource"><span><strong>学校心理支持</strong><small>${h(site.supportLocation || "请向辅导员了解心理咨询中心的位置和预约方式。")}</small><small>${h(site.supportHours || "服务时间待学校确认")}</small></span>${phone ? `<a class="button primary" href="tel:${phone}">拨打</a>` : '<small>电话待学校配置</small>'}</section><section class="mini-resource"><span><strong>医疗急救</strong><small>出现紧急健康危险时拨打</small></span><a class="button primary" href="tel:120">120</a></section><section class="mini-resource"><span><strong>公安报警</strong><small>面临即时人身危险时拨打</small></span><a class="button secondary" href="tel:110">110</a></section><section class="mini-help-tip"><h3>如何陪伴正在困扰中的同学</h3><p>认真倾听，不评判；询问“我能为你做什么”；鼓励联系专业人员；涉及安全风险时及时告诉有能力提供帮助的人。</p></section><p class="mini-help-note">校内心理中心和保卫部门的联系方式请以学校正式发布的信息为准。</p></div>`);
  }
  function privacy() { set(`<section class="card narrow"><h2>关于你的信息</h2>${privacyText()}${button("返回首页", "dashboard", true)}</section>`); }
  function personality(start) {
    const { h } = C(); const p = window.Personality;
    if (!start) { set(`<div class="mini-personality"><header class="mini-personality-banner"><span>🎨</span><h2>趣味人格测试</h2><p>通过轻松有趣的方式探索自己</p></header><p class="mini-disclaimer">ⓘ 本测试仅供娱乐与自我探索参考，不用于心理健康判断。结果不会上传给辅导员。</p><button class="mini-personality-test" data-route="personality/quiz"><span class="mini-personality-icon">🧭</span><span><strong>16 型人格探索</strong><small>通过 28 道自研选择题，了解你的偏好与行为方式</small><em>28 题 · 约 8 分钟</em></span><b>›</b></button></div>`); return; }
    const personalityKey = `campus:${C().state.user.id}:personality-draft`;
    let answers = {}, index = 0;
    try { const previous = JSON.parse(sessionStorage.getItem(personalityKey) || "null"); if (previous && previous.answers && Number.isInteger(previous.index) && previous.index >= 0 && previous.index < p.MBTI_QUESTIONS.length) { answers = previous.answers; index = previous.index; } } catch (_) {}
    const savePersonality = () => { try { sessionStorage.setItem(personalityKey, JSON.stringify({ answers, index })); } catch (_) { C().notice("当前浏览器无法保存人格探索进度", true); } };
    const draw = () => {
      const q = p.MBTI_QUESTIONS[index]; set(`<section class="card narrow mini-personality-quiz"><div class="mini-personality-progress"><progress value="${index+1}" max="${p.MBTI_QUESTIONS.length}" aria-label="人格探索进度"></progress><span>${index + 1} / ${p.MBTI_QUESTIONS.length}</span></div><h2>${h(q.title)}</h2>${q.options.map((o, i) => `<button class="answer-option personality-option" data-choice="${i}"><span class="mini-option-label">${h(o.label)}</span><span>${h(o.text)}</span></button>`).join("")}<p class="hint">本探索不用于心理健康评分，也不会向辅导员展示个人结果。</p><button class="button secondary" id="personality-back" ${index === 0 ? "disabled" : ""}>上一题</button></section>`);
      el("personality-back").onclick = () => { index--; savePersonality(); draw(); };
      document.querySelectorAll("[data-choice]").forEach(b => b.onclick = () => { answers[index] = Number(b.dataset.choice); if (++index < p.MBTI_QUESTIONS.length) { savePersonality(); return draw(); } try { sessionStorage.removeItem(personalityKey); } catch (_) {} const outcome = p.calculateType(answers); const r = outcome.result;
        set(`<section class="card narrow mini-personality-result"><header class="mini-personality-result-head"><span>🎨</span><div class="mini-personality-eyebrow">探索结果</div><h2>${h(r.name || r.title || "")}</h2><p>${h(r.title)}</p></header><div class="mini-result-section"><h3>你的偏好代码</h3><strong class="mini-personality-code">${h(outcome.type)}</strong><p>它描述当前偏好，不代表能力高低，也不是永久不变的身份。</p></div><div class="mini-result-section"><h3>探索分析</h3><p class="article-body">${h(r.description || r.desc || "这是一份关于个人偏好的探索结果。")}</p></div><div class="mini-result-section"><h3>可能的优势</h3><p>${h(r.strengths)}</p></div><div class="mini-result-section"><h3>成长建议</h3><p>把类型当作观察自己的起点，而不是固定标签；在不同情境中尝试不熟悉但有帮助的行为方式；重要选择仍应结合能力、兴趣、价值观与现实条件。</p></div><div class="mini-result-section"><h3>可探索方向</h3><p>${h(r.careers)}</p></div><div class="mini-result-section"><h3>四组偏好</h3><div class="grid two">${Object.entries(p.MBTI_DIMENSIONS).map(([key, d]) => `<div><h4>${h(d.left)} / ${h(d.right)}</h4><p>${outcome.scores[key[0]]} / ${outcome.scores[key[1]]}</p></div>`).join("")}</div></div><p class="mini-disclaimer">本结果仅供娱乐与自我探索，不属于专业心理评估，也不进入风险预警。</p>${button("重新探索", "personality")}</section>`);
      });
    }; draw();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && activeDraft) save(activeDraft); });
  window.addEventListener("pagehide", () => { if (activeDraft) save(activeDraft); });
  window.StudentApp = { render };
})();
