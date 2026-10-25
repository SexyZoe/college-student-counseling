(function(){
 'use strict'
 window.createCommitteeUI=function({state,request,json,h,notice,modal,openDialog,dialogHead,heading,field,button,busy}){
  let data=null,meta=null,dirty=false
  const filters={semesterId:'',q:'',college:'',campus:'',counselorId:'',memberStatus:'active',includeArchived:''}
  const time=v=>new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})
  const active=(epoch,id)=>state.epoch===epoch&&state.user?.id===id
  const path=id=>'/committee/classes/'+encodeURIComponent(id)
  function cleanup(){modal.classList.remove('committee-export-dialog');data=null;meta=null;dirty=false;Object.keys(filters).forEach(k=>filters[k]='');filters.memberStatus='active'}
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}})
  function guard(){modal.oncancel=e=>{if(dirty&&!confirm('内容尚未保存，确认放弃本次修改？'))e.preventDefault()};modal.onclose=()=>{dirty=false};modal.querySelectorAll('[data-close],#committee-cancel').forEach(b=>b.onclick=()=>{if(!dirty||confirm('内容尚未保存，确认放弃本次修改？')){dirty=false;modal.close()}})}
  function ownerOptions(id){return '<option value="">请选择负责辅导员</option>'+state.counselors.filter(c=>c.active).map(c=>`<option value="${h(c.id)}" ${c.id===id?'selected':''}>${h(c.displayName)} · ${h(c.staffId)}</option>`).join('')}
  async function page(){
   const epoch=++state.epoch,userId=state.user.id,admin=state.user.role==='admin'
   document.getElementById('content').innerHTML='<p class="loading">正在读取班级心理委员名单…</p>'
   const options=await request('/weekly-ledgers/options');if(!active(epoch,userId))return;meta=options
   const term=meta.semesters.find(s=>s.id===filters.semesterId)||meta.semesters.find(s=>s.current)||meta.semesters[0]
   if(!term){document.getElementById('content').innerHTML=heading('CLASS WELLBEING CONTACTS','班级心理委员','请先由管理员在学期管理中建立学期。');return}
   filters.semesterId=term.id
   const result=await request('/committee/classes?'+new URLSearchParams(filters));if(!active(epoch,userId))return;data=result
   const colleges=Object.keys(data.headers),missing=[...new Set(data.classes.filter(c=>!c.headers.schoolTeacherName||!c.headers.collegeLeaderName).map(c=>c.college))]
   document.getElementById('content').innerHTML=heading('CLASS WELLBEING CONTACTS','班级心理委员',admin?'汇总查看各辅导员负责班级的心理委员，按学校原表导出。':'维护本人班级的心理委员名单，按学校原表导出。',admin?'':button('＋ 添加班级','committee-new-class','primary'))+`${meta.demo?'<p class="weekly-calendar-warning">本地演示使用虚构委员及联系方式，导出用于检查学校原表格式。</p>':''}<div class="stats"><article><span>当前范围内的班级</span><strong>${data.counts.classes}<small>个</small></strong><p>${h(data.semesterName)}</p></article><article><span>符合查询的心理委员</span><strong>${data.counts.members}<small>人</small></strong><p>${data.counts.missing} 个在用班级尚未设置在任委员</p></article><article class="stat-note"><span>学校原表导出</span><h3>正面名单 · 反面对接表</h3><p>原表格式保留，反面工作记录留空待填写。</p></article></div><section class="panel"><form id="committee-filter" class="filters"><label>学期<select name="semesterId">${meta.semesters.map(s=>`<option value="${h(s.id)}" ${s.id===term.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></label>${admin?`<label>负责辅导员<select name="counselorId"><option value="">全部辅导员</option>${state.counselors.map(c=>`<option value="${h(c.id)}" ${c.id===filters.counselorId?'selected':''}>${h(c.displayName)}${c.active?'':'（已停用）'}</option>`).join('')}</select></label>`:''}${field('学院','college',filters.college,'placeholder="全部学院"')}${field('校区','campus',filters.campus,'placeholder="全部校区"')}<label>任职状态<select name="memberStatus">${[['active','在任委员'],['former','已离任委员'],['all','全部委员']].map(([v,t])=>`<option value="${v}" ${v===filters.memberStatus?'selected':''}>${t}</option>`).join('')}</select></label><label class="search-label">搜索<input name="q" value="${h(filters.q)}" placeholder="班级、姓名、学号或联系方式"></label><button class="button secondary" type="submit">查询</button>${button('重置','committee-reset','ghost')}<label class="check-line committee-archived"><input type="checkbox" name="includeArchived" value="1" ${filters.includeArchived?'checked':''}>包含停用班级</label></form><div class="table-toolbar"><div><h2>班级心理委员名单 <span class="count">${data.counts.members}</span></h2><p>按教师选择表格，先预览学校原表，再单独下载或打包所选文件。</p>${missing.length?`<p class="warning">${h(missing.join('、'))}的原表负责人信息尚未补齐，未填写项将留空。</p>`:''}</div><div class="actions">${admin?'':button('原表表头设置','committee-headers','ghost')}${button('按学校原表导出 Excel','committee-export','primary')}</div></div><div class="table-scroll"><table class="committee-table"><thead><tr><th>校区</th><th>辅导员</th><th>年级专业班级</th><th>心理委员</th><th>性别</th><th>联系方式</th><th>任职状态</th><th>操作</th></tr></thead><tbody>${data.classes.map(c=>`<tr class="committee-class-row"><td colspan="8"><div class="committee-class-line"><div><strong>${h(c.name)}</strong><span class="cell-sub">${h(c.college)} · ${h(c.campus)} · 负责：${h(c.counselorName)} · ${c.active?'在用':'已停用'}</span></div><div class="actions"><button class="text-button" data-committee-open="${h(c.id)}">${admin?'查看委员':'管理委员'}</button>${admin?'':`<button class="text-button" data-committee-class="${h(c.id)}">班级设置</button><button class="text-button" data-committee-copy="${h(c.id)}">沿用到其他学期</button>`}</div></div></td></tr>${c.members.map(m=>`<tr><td>${h(c.campus)}</td><td>${h(c.counselorName)}</td><td>${h(c.name)}</td><td><strong>${h(m.name)}</strong><small class="cell-sub">${h(m.studentNo)}</small></td><td>${h(m.gender)||'—'}</td><td>${h(m.phone)||'<span class="warning">待补充</span>'}</td><td><span class="weekly-status ${m.status==='active'?'completed':'draft'}">${m.status==='active'?'在任':'已离任'}</span></td><td><button class="text-button" data-committee-open="${h(c.id)}">${admin?'查看':'查看 / 编辑'}</button></td></tr>`).join('')||'<tr><td colspan="8" class="muted">当前条件下暂无委员，点击“'+(admin?'查看委员':'管理委员')+'”查看完整名单。</td></tr>'}`).join('')||`<tr><td colspan="8"><div class="empty"><span>♧</span><h3>当前没有班级</h3><p>${admin?'请调整筛选条件，或等待辅导员登记班级名单。':'添加负责班级后，可以登记该班的多名心理委员。'}</p></div></td></tr>`}</tbody></table></div><div class="table-foot">班级工作联系人独立管理 · 换届时标为离任，原学期名单继续保留</div></section>`
   const form=document.getElementById('committee-filter');form.onsubmit=e=>{e.preventDefault();Object.assign(filters,Object.fromEntries(new FormData(form)),{includeArchived:form.elements.includeArchived.checked?'1':''});page().catch(e=>notice(e.message,true))}
   document.getElementById('committee-reset').onclick=()=>{Object.assign(filters,{q:'',college:'',campus:'',counselorId:'',memberStatus:'active',includeArchived:''});page().catch(e=>notice(e.message,true))}
   document.getElementById('committee-new-class')?.addEventListener('click',()=>classForm())
   document.querySelectorAll('[data-committee-open]').forEach(b=>b.onclick=()=>openClass(b.dataset.committeeOpen).catch(e=>notice(e.message,true)))
   document.querySelectorAll('[data-committee-class]').forEach(b=>b.onclick=()=>classForm(data.classes.find(c=>c.id===b.dataset.committeeClass)))
   document.querySelectorAll('[data-committee-copy]').forEach(b=>b.onclick=()=>copyForm(data.classes.find(c=>c.id===b.dataset.committeeCopy)))
   document.getElementById('committee-headers')?.addEventListener('click',()=>headersForm())
   document.getElementById('committee-export').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await exportDialog()}catch(error){notice(error.message,true)}finally{b.disabled=false}}
  }
  function classForm(c){
   if(state.user.role!=='counselor')return
   const r=c||{},admin=state.user.role==='admin',term=meta.semesters.find(s=>s.id===filters.semesterId);dirty=false
   openDialog(dialogHead(c?'班级设置':'添加负责班级','同一学期、学院和校区内，班级名称保持唯一。每个班级可以登记多名心理委员。')+`<form id="committee-class-form">${admin?`<label>负责辅导员 *<select name="counselorId" required>${ownerOptions(r.counselorId)}</select></label>`:''}<p class="muted small">所属学期：${h(term.name)}</p><div class="form-grid">${field('学院 *','college',r.college||state.profile?.college||filters.college||'','required maxlength="100"')}${field('校区 *','campus',r.campus||filters.campus||'','required maxlength="100"')}${field('年级专业班级 *','name',r.name||'','required maxlength="150" placeholder="例如：2026级计算机科学与技术1班"')}</div>${c?`<label class="check-line"><input type="checkbox" name="active" ${r.active?'checked':''}>班级在用（停用后名单保留，默认查询与导出不包含）</label>`:''}<div class="dialog-actions">${button('取消','committee-cancel','ghost')}<button class="button primary" type="submit">保存班级</button></div></form>`)
   guard();const form=document.getElementById('committee-class-form');form.oninput=()=>{dirty=true};form.onsubmit=busy(form,async()=>{const epoch=state.epoch,userId=state.user.id,input={...Object.fromEntries(new FormData(form)),semesterId:filters.semesterId,...(c?{revision:c.revision,active:form.elements.active.checked}:{})};await request(c?path(c.id):'/committee/classes',json(c?'PATCH':'POST',input));if(!active(epoch,userId))return;dirty=false;modal.close();await page();notice('班级已保存')})
  }
  async function openClass(id){const epoch=state.epoch,userId=state.user.id,c=await request(path(id));if(active(epoch,userId))classDialog(c)}
  function classDialog(c){
   dirty=false;const admin=state.user.role==='admin'
   openDialog(dialogHead(h(c.name)+' · 心理委员名单',h(c.college)+' · '+h(c.campus)+' · 负责辅导员：'+h(c.counselorName))+`${admin?`<dl class="readonly-detail">${[['对接校心理专职教师',c.headers?.schoolTeacherName],['校心理专职教师联系方式',c.headers?.schoolTeacherContact],['学院心理工作负责人',c.headers?.collegeLeaderName],['学院心理工作负责人联系方式',c.headers?.collegeLeaderContact]].map(([k,v])=>`<div><dt>${k}</dt><dd>${h(v)||'—'}</dd></div>`).join('')}</dl>`:''}<div class="table-toolbar committee-dialog-toolbar"><p class="muted small">在任与离任名单均保留，每位委员单独登记。</p>${!admin&&c.active?button('＋ 添加心理委员','committee-add-member','primary'):''}</div><div class="table-scroll"><table class="committee-member-table"><thead><tr><th>姓名 / 学号</th><th>性别</th><th>联系方式</th><th>任职状态</th><th>操作</th></tr></thead><tbody>${c.members.map(m=>`<tr><td>${h(m.name)}<small class="cell-sub">${h(m.studentNo)}</small></td><td>${h(m.gender)||'—'}</td><td>${h(m.phone)||'待补充'}</td><td>${m.status==='active'?'在任':'已离任'}</td><td><button type="button" class="text-button" data-committee-member="${h(m.id)}">${admin||!c.active?'查看':'编辑 / 离任'}</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">该班级尚未登记心理委员。</td></tr>'}</tbody></table></div><div class="dialog-actions">${button('关闭','committee-cancel','ghost')}</div>`)
   guard();document.getElementById('committee-add-member')?.addEventListener('click',()=>memberForm(c))
   document.querySelectorAll('[data-committee-member]').forEach(b=>b.onclick=()=>memberForm(c,c.members.find(m=>m.id===b.dataset.committeeMember)))
  }
  function memberForm(c,m){
   dirty=false;const r=m||{},readOnly=state.user.role==='admin'||!c.active
   openDialog(dialogHead(readOnly?'查看心理委员':m?'编辑心理委员':'添加心理委员',h(c.name)+' · '+h(c.college))+`<form id="committee-member-form"><fieldset ${readOnly?'disabled':''}><div class="form-grid">${field('姓名 *','name',r.name,'required maxlength="50"')}${field('学号（选填，用于核对重复）','studentNo',r.studentNo,'maxlength="50"')}<label>性别<select name="gender">${['','男','女','其他','未填写'].map(v=>`<option value="${v}" ${v===r.gender?'selected':''}>${v||'请选择'}</option>`).join('')}</select></label>${field('联系方式','phone',r.phone,'maxlength="100"')}<label>任职状态<select name="status"><option value="active" ${r.status!=='former'?'selected':''}>在任</option><option value="former" ${r.status==='former'?'selected':''}>已离任</option></select></label></div></fieldset>${m?`<p class="muted small">首次登记：${h(time(m.createdAt))}<br>最后修改：${h(time(m.updatedAt))}</p>`:''}<p class="muted small">离任后保留记录，默认导出只包含在任委员。</p><div class="dialog-actions">${button('返回班级','committee-back','ghost')}${readOnly?'':'<button class="button primary" type="submit">保存委员</button>'}</div></form>`)
   guard();document.getElementById('committee-back').onclick=()=>{if(!dirty||confirm('内容尚未保存，确认返回？')){dirty=false;classDialog(c)}}
   const form=document.getElementById('committee-member-form');if(!readOnly){form.oninput=()=>{dirty=true};form.onsubmit=busy(form,async()=>{const epoch=state.epoch,userId=state.user.id,input={...Object.fromEntries(new FormData(form)),...(m?{revision:m.revision}:{})};await request(path(c.id)+'/members'+(m?'/'+encodeURIComponent(m.id):''),json(m?'PATCH':'POST',input));if(!active(epoch,userId))return;dirty=false;await page();await openClass(c.id);notice('心理委员已保存')})}
  }
  function copyForm(c){
   if(state.user.role!=='counselor')return
   dirty=false;const terms=meta.semesters.filter(s=>s.id!==c.semesterId),admin=state.user.role==='admin'
   openDialog(dialogHead('沿用到其他学期','复制班级及在任委员，原学期名单完整保留。目标学期已有同名班级时会提示核对。')+`<form id="committee-copy-form"><p>${h(c.name)} · ${h(c.college)}</p><div class="form-grid"><label>目标学期 *<select name="semesterId" required><option value="">请选择目标学期</option>${terms.map(s=>`<option value="${h(s.id)}">${h(s.name)}</option>`).join('')}</select></label>${admin?`<label>目标学期负责辅导员 *<select name="counselorId" required>${ownerOptions(c.counselorId)}</select></label>`:''}</div>${!terms.length?'<p class="warning">尚无其他学期，请先联系管理员新增学期。</p>':''}<div class="dialog-actions">${button('取消','committee-cancel','ghost')}<button class="button primary" type="submit" ${terms.length?'':'disabled'}>沿用名单</button></div></form>`)
   guard();const form=document.getElementById('committee-copy-form');form.onsubmit=busy(form,async()=>{const epoch=state.epoch,userId=state.user.id,input=Object.fromEntries(new FormData(form));await request(path(c.id)+'/copy',json('POST',input));if(!active(epoch,userId))return;filters.semesterId=input.semesterId;filters.q='';modal.close();await page();notice('已沿用到所选学期，原名单保持不变')})
  }
  function headersForm(){
   if(state.user.role!=='counselor')return
   dirty=false;const colleges=Object.keys(data.headers);if(!colleges.length)return notice('请先添加班级，确定所属学院',true)
   let current=colleges[0],r=data.headers[current]
   openDialog(dialogHead('学院原表表头设置','本人同一学院的班级使用此表头，不影响其他辅导员。导出时自动填入原表。')+`<form id="committee-header-form"><label>学院<select name="college">${colleges.map(c=>`<option>${h(c)}</option>`).join('')}</select></label><div class="form-grid">${field('对接校心理专职教师','schoolTeacherName',r.schoolTeacherName,'maxlength="50"')}${field('校心理专职教师联系方式','schoolTeacherContact',r.schoolTeacherContact,'maxlength="100"')}${field('学院心理工作负责人','collegeLeaderName',r.collegeLeaderName,'maxlength="50"')}${field('学院心理工作负责人联系方式','collegeLeaderContact',r.collegeLeaderContact,'maxlength="100"')}</div><div class="dialog-actions">${button('取消','committee-cancel','ghost')}<button class="button primary" type="submit">保存表头信息</button></div></form>`)
   guard();const form=document.getElementById('committee-header-form');form.oninput=e=>{if(e.target.name!=='college')dirty=true};form.elements.college.onchange=()=>{if(dirty&&!confirm('切换学院将放弃未保存修改，是否继续？')){form.elements.college.value=current;return}current=form.elements.college.value;r=data.headers[current];for(const key of ['schoolTeacherName','schoolTeacherContact','collegeLeaderName','collegeLeaderContact'])form.elements[key].value=r[key];dirty=false}
   form.onsubmit=busy(form,async()=>{const epoch=state.epoch,userId=state.user.id;await request('/committee/college-headers',json('PATCH',{...Object.fromEntries(new FormData(form)),revision:r.revision}));if(!active(epoch,userId))return;dirty=false;modal.close();await page();notice('原表表头已保存')})
  }
  async function exportDialog(){
   const epoch=state.epoch,userId=state.user.id,scope={...filters},options=await request('/committee/export/options',json('POST',scope));if(!active(epoch,userId))return
   dirty=false;const files=options.files,selected=new Set(),cache=new Map();let current=null,search='',college='',previewSequence=0,closed=false,zoom=100,view='content',downloading=false
   modal.classList.add('committee-export-dialog')
   openDialog(dialogHead('选择表格与预览','按教师选择需要的材料，确认学校原表效果后下载。')+`<div class="committee-export-scope"><strong>${h(options.semesterName)}</strong><span>沿用当前页面的查询范围 · ${scope.memberStatus==='former'?'已离任委员':scope.memberStatus==='all'?'全部任职状态':'在任委员'}${scope.includeArchived?' · 包含停用班级':''}</span></div><div class="committee-export-workspace"><section class="committee-export-picker" aria-label="选择教师表格"><div class="committee-export-search"><label>查找教师或学院<input id="committee-export-search" placeholder="输入教师姓名、工号或学院"></label><label>学院<select id="committee-export-college"><option value="">全部学院</option>${[...new Set(files.map(f=>f.college))].map(c=>`<option>${h(c)}</option>`).join('')}</select></label></div><div class="committee-export-picker-head"><label class="check-line"><input type="checkbox" id="committee-export-all">全选当前列表</label><span id="committee-export-visible"></span></div><div id="committee-export-files"></div></section><section class="committee-export-preview" aria-label="学校原表预览"><div id="committee-export-preview-head"><h3>原表预览</h3><p class="muted small">点击左侧“预览”，查看 Excel 中的正面名单和反面对接表。</p></div><div id="committee-export-preview-body"><div class="empty"><span>▧</span><h3>先选择一份表格预览</h3><p>勾选只决定下载范围，预览不会自动勾选其他教师的数据。</p></div></div></section></div><div class="committee-export-footer"><div><strong id="committee-export-selection">尚未选择表格</strong><p class="muted small" id="committee-export-download-note">选一份下载 Excel；选多份仅打包所选表格。</p></div><div class="actions">${button('重新载入列表','committee-export-reload','ghost')}${button('清空选择','committee-export-clear','ghost')}<button type="button" class="button primary" id="committee-export-selected" disabled>下载所选</button></div></div>`)
   const live=()=>!closed&&active(epoch,userId)&&modal.open
   modal.oncancel=()=>{};modal.onclose=()=>{if(modal.open)return;closed=true;previewSequence++;cache.clear();modal.classList.remove('committee-export-dialog')}
   const visibleFiles=()=>files.filter(f=>(!college||f.college===college)&&(!search||[f.counselorName,f.college,state.counselors.find(c=>c.id===f.counselorId)?.staffId||''].join(' ').toLowerCase().includes(search)))
   const payload=chosen=>({...scope,fileIds:chosen.map(f=>f.id),versions:Object.fromEntries(chosen.map(f=>[f.id,f.version]))})
   function selectionNote(){
    const list=visibleFiles(),count=selected.size,teachers=new Set(files.filter(f=>selected.has(f.id)).map(f=>f.counselorId)).size,all=document.getElementById('committee-export-all')
    document.getElementById('committee-export-selection').textContent=count?'已选择 '+teachers+' 位教师 · '+count+' 份表格':'尚未选择表格'
    document.getElementById('committee-export-visible').textContent=list.length+' 份表格'
    document.getElementById('committee-export-selected').textContent=count>1?'打包下载所选（'+count+' 份）':'下载所选 Excel'
    document.getElementById('committee-export-selected').disabled=!count||downloading
    all.checked=!!list.length&&list.every(f=>selected.has(f.id));all.indeterminate=!all.checked&&list.some(f=>selected.has(f.id));all.disabled=!list.length
    document.getElementById('committee-export-download-note').textContent=count>1?'压缩包仅包含勾选的 '+count+' 份表格，每份保留学校原表正反两面。':'选一份下载 Excel；选多份仅打包所选表格。'
    document.querySelectorAll('[data-export-teacher]').forEach(c=>{const group=list.filter(f=>f.counselorId===c.dataset.exportTeacher);c.checked=group.every(f=>selected.has(f.id));c.indeterminate=!c.checked&&group.some(f=>selected.has(f.id))})
   }
   function drawFiles(){
    const list=visibleFiles(),teachers=[...new Set(list.map(f=>f.counselorId))]
    document.getElementById('committee-export-files').innerHTML=teachers.map(id=>{const group=list.filter(f=>f.counselorId===id),c=state.counselors.find(c=>c.id===id),first=group[0];return `<section class="committee-export-teacher"><label class="check-line"><input type="checkbox" data-export-teacher="${h(id)}" aria-label="选择${h(first.counselorName)}的当前表格"><strong>${h(first.counselorName)}</strong><small>${h(c?.staffId)}${c&&!c.active?' · 已停用':''}</small></label>${group.map(f=>`<article class="committee-export-file ${current===f.id?'is-previewing':''}" data-export-card="${h(f.id)}"><label class="check-line"><input type="checkbox" data-export-file="${h(f.id)}" aria-label="选择${h(f.counselorName)}${h(f.college)}表格" ${selected.has(f.id)?'checked':''}><span><strong>${h(f.college)}</strong><small>${f.classCount} 个班级 · ${f.memberCount} 名委员 · ${h(f.campuses.join('、'))}</small></span></label><div class="committee-export-file-actions"><button type="button" class="text-button" data-export-preview="${h(f.id)}">${current===f.id?'正在预览':'预览'}</button><button type="button" class="text-button" data-export-download="${h(f.id)}" ${downloading?'disabled':''}>单独下载 Excel</button></div></article>`).join('')}</section>`}).join('')||'<div class="empty"><h3>没有符合条件的表格</h3><p>可调整查找条件，或返回页面调整学期和班级范围。</p></div>'
    document.querySelectorAll('[data-export-file]').forEach(c=>c.onchange=()=>{c.checked?selected.add(c.dataset.exportFile):selected.delete(c.dataset.exportFile);selectionNote()})
    document.querySelectorAll('[data-export-teacher]').forEach(c=>c.onchange=()=>{for(const f of list.filter(f=>f.counselorId===c.dataset.exportTeacher))c.checked?selected.add(f.id):selected.delete(f.id);drawFiles()})
    document.querySelectorAll('[data-export-preview]').forEach(b=>b.onclick=()=>previewFile(files.find(f=>f.id===b.dataset.exportPreview)))
    document.querySelectorAll('[data-export-download]').forEach(b=>b.onclick=()=>downloadFiles([files.find(f=>f.id===b.dataset.exportDownload)]))
    selectionNote()
   }
   function showPreview(result){
    const box=document.getElementById('committee-export-preview-body');box.innerHTML=`<div class="committee-export-preview-tools"><span>${result.pageCount} 页 · 正面名单与反面对接表</span><label>预览范围<select id="committee-export-view"><option value="content" ${view==='content'?'selected':''}>表格区域</option><option value="page" ${view==='page'?'selected':''}>整页纸张</option></select></label><label>显示大小<select id="committee-export-zoom">${[100,125,150,200].map(n=>`<option value="${n}" ${zoom===n?'selected':''}>${n===100?'适应宽度':n+'%'}</option>`).join('')}</select></label></div><div class="committee-export-pages">${result.pages.map((src,i)=>`<figure style="width:${zoom}%"><figcaption>第 ${i+1} 页 / 共 ${result.pageCount} 页</figcaption><div class="committee-export-page-image"><img src="${h(src)}" alt="${h(result.file.counselorName)}心理委员学校原表第 ${i+1} 页"></div></figure>`).join('')}</div>${result.fontNotice?`<p class="committee-export-font-note">${h(result.fontNotice)}</p>`:''}`
    // Show the original rendered pixels; fitting the table region omits only blank page margins.
    const bounds=new WeakMap()
    function fitImage(img){
     if(!img.naturalWidth)return
     const full={left:0,top:0,width:img.naturalWidth,height:img.naturalHeight};let box=full
     if(view==='content'){
      if(!bounds.has(img)){
       const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight
       const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0)
       const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=0,bottom=0
       for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if(pixels[i+3]>64&&Math.min(pixels[i],pixels[i+1],pixels[i+2])<230){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}
       if(right>left&&bottom>top){const x=Math.max(0,left-24),y=Math.max(0,top-24);bounds.set(img,{left:x,top:y,width:Math.min(canvas.width,right+25)-x,height:Math.min(canvas.height,bottom+25)-y})}else bounds.set(img,full)
       canvas.width=0;canvas.height=0
      }box=bounds.get(img)
     }
     const frame=img.parentElement;frame.style.aspectRatio=box.width+' / '+box.height
     img.style.width=(img.naturalWidth/box.width*100)+'%';img.style.left=-(box.left/box.width*100)+'%';img.style.top=-(box.top/box.height*100)+'%'
    }
    box.querySelectorAll('.committee-export-page-image img').forEach(img=>{img.onload=()=>fitImage(img);if(img.complete)fitImage(img)})
    document.getElementById('committee-export-view').onchange=e=>{view=e.target.value;box.querySelectorAll('.committee-export-page-image img').forEach(fitImage)}
    document.getElementById('committee-export-zoom').onchange=e=>{zoom=Number(e.target.value);box.querySelectorAll('figure').forEach(f=>f.style.width=zoom+'%')}
   }
   async function previewFile(f){
    current=f.id;const sequence=++previewSequence;drawFiles()
    document.getElementById('committee-export-preview-head').innerHTML=`<h3>${h(f.counselorName)} · ${h(f.college)}</h3><p class="committee-export-filename">${h(f.fileName)}</p>`
    document.getElementById('committee-export-preview-body').innerHTML='<p class="loading" role="status">正在生成学校原表预览…</p>'
    try{let result=cache.get(f.id);if(!result){result=await request('/committee/export/preview',json('POST',payload([f])));if(!live())return;if(cache.size>=3)cache.delete(cache.keys().next().value);cache.set(f.id,result)}if(live()&&sequence===previewSequence)showPreview(result)}catch(e){if(live()&&sequence===previewSequence){document.getElementById('committee-export-preview-body').innerHTML=`<div class="empty"><h3>暂未生成预览</h3><p>${h(e.message)}</p>${button('重试预览','committee-export-retry','secondary')}</div>`;document.getElementById('committee-export-retry').onclick=()=>previewFile(f)}}
   }
   async function downloadFiles(chosen){
    if(!chosen.length||downloading)return;downloading=true;drawFiles()
    try{const blob=await request('/committee/export',{...json('POST',payload(chosen)),binary:true});if(!live())return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=chosen.length===1?chosen[0].fileName:'心理委员所选表格-'+options.semesterName+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice(chosen.length===1?'已下载所选教师的 Excel 原表':'已打包勾选的 '+chosen.length+' 份表格')}catch(e){if(live())notice(e.message,true)}finally{downloading=false;if(live())drawFiles()}
   }
   document.getElementById('committee-export-search').oninput=e=>{search=e.target.value.trim().toLowerCase();drawFiles()}
   document.getElementById('committee-export-college').onchange=e=>{college=e.target.value;drawFiles()}
   document.getElementById('committee-export-all').onchange=e=>{for(const f of visibleFiles())e.target.checked?selected.add(f.id):selected.delete(f.id);drawFiles()}
   document.getElementById('committee-export-clear').onclick=()=>{selected.clear();drawFiles()}
   document.getElementById('committee-export-selected').onclick=()=>downloadFiles(files.filter(f=>selected.has(f.id)))
   document.getElementById('committee-export-reload').onclick=async()=>{const b=document.getElementById('committee-export-reload');b.disabled=true;try{const updated=await request('/committee/export/options',json('POST',scope));if(!live())return;files.splice(0,files.length,...updated.files);cache.clear();previewSequence++;selected.clear();current=null;drawFiles();document.getElementById('committee-export-preview-head').innerHTML='<h3>原表预览</h3>';document.getElementById('committee-export-preview-body').innerHTML='<div class="empty"><h3>列表已更新</h3><p>请重新选择需要的教师表格。</p></div>';notice('导出列表已更新，请重新选择')}catch(e){if(live())notice(e.message,true)}finally{b.disabled=false}}
   drawFiles()
  }
  return {page,cleanup}
 }
})()
