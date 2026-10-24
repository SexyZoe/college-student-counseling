(function(){
 'use strict'
 window.createTalkUI=function({state,request,json,h,notice,modal,openDialog,dialogHead,heading,field,button,busy}){
  let records=[],students=[],metadata=null,dirty=false,urls=[]
  const filters={q:'',from:'',to:'',counselorId:''}
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const time=v=>v?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—'
  const recordUrl=(r,format,extra={})=>'/talk-records/'+encodeURIComponent(r.id)+'/document?'+new URLSearchParams({format,revision:r.revision,...extra})
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}})
  function cleanup(){dirty=false;records=[];students=[];metadata=null;urls.forEach(u=>URL.revokeObjectURL(u));urls=[];Object.assign(filters,{q:'',from:'',to:'',counselorId:''})}
  function watchClose(){modal.oncancel=e=>{if(dirty&&!confirm('内容尚未保存，确认放弃本次修改？'))e.preventDefault()};modal.onclose=()=>{dirty=false};modal.querySelectorAll('[data-close],#talk-cancel').forEach(b=>b.onclick=()=>{if(!dirty||confirm('内容尚未保存，确认放弃本次修改？')){dirty=false;modal.close()}})}
  async function page(){
   const epoch=++state.epoch,admin=state.user.role==='admin'
   document.getElementById('content').innerHTML='<p class="loading">正在读取谈话记录…</p>'
   const [rows,options]=await Promise.all([request('/talk-records?'+new URLSearchParams(filters)),request('/talk-records/options')]);if(epoch!==state.epoch)return
   records=rows;metadata=options
   document.getElementById('content').innerHTML=heading('CONVERSATION RECORDS','学生谈话记录',admin?'查看各辅导员与学生的谈话记录，按学校原表预览、导出和打印。':'每次谈话单独保存，随时继续修改，按学校原表打印。',admin?'':button('＋ 新建谈话记录','new-talk','primary'))+`<section class="panel talk-summary"><div><span class="eyebrow">${admin?'全校谈话档案':'我的谈话档案'}</span><strong>${rows.length}<small>份记录</small></strong></div><p>保存时间与修改时间由系统记录。签名栏保留为空白，供打印后手签。</p></section><section class="panel"><form id="talk-filter" class="filters"><label class="search-label">搜索学生<input name="q" value="${h(filters.q)}" placeholder="姓名、学号、学院或班级"></label>${admin?`<label>辅导员<select name="counselorId"><option value="">全部辅导员</option>${state.counselors.map(c=>`<option value="${h(c.id)}" ${c.id===filters.counselorId?'selected':''}>${h(c.displayName)}${c.active?'':'（已停用）'}</option>`).join('')}</select></label>`:''}${field('谈话日期从','from',filters.from,'type="date"')}${field('至','to',filters.to,'type="date"')}<button type="submit" class="button secondary">查询</button>${button('重置','talk-reset','ghost')}</form><div class="table-scroll"><table class="talk-table"><thead><tr><th>学生</th><th>学院 / 年级专业班级</th><th>谈话日期</th>${admin?'<th>负责辅导员</th>':''}<th>首次保存</th><th>最后修改</th><th>操作</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><strong>${h(r.name)}</strong><small class="cell-sub">${h(r.studentNo)}</small></td><td>${h(r.college)||'未填写'}<small class="cell-sub">${h(r.gradeClass)}</small></td><td>${h(r.talkDate)||'未填写'}</td>${admin?`<td>${h(r.counselorName)}</td>`:''}<td>${h(time(r.createdAt))}</td><td>${h(time(r.updatedAt))}<small class="cell-sub">${r.printCheck.ready?'资料已填写，可预览校验':'可继续补充或调整'}</small></td><td><button type="button" class="text-button" data-talk="${h(r.id)}">${admin?'查看谈话表':'查看 / 编辑'}</button></td></tr>`).join(''):`<tr><td colspan="${admin?7:6}"><div class="empty"><span>▤</span><h3>暂无谈话记录</h3><p>${admin?'辅导员保存后，可以在这里查看。':'点击“新建谈话记录”，在线填写学校谈话表。'}</p></div></td></tr>`}</tbody></table></div></section>`
   const form=document.getElementById('talk-filter');form.onsubmit=e=>{e.preventDefault();Object.assign(filters,Object.fromEntries(new FormData(form)));page().catch(e=>notice(e.message,true))}
   document.getElementById('talk-reset').onclick=()=>{Object.assign(filters,{q:'',from:'',to:'',counselorId:''});page().catch(e=>notice(e.message,true))}
   document.getElementById('new-talk')?.addEventListener('click',()=>open().catch(e=>notice(e.message,true)))
   document.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>open(b.dataset.talk).catch(e=>notice(e.message,true)))
  }
  async function open(id){
   const epoch=state.epoch,userId=state.user.id
   const [record,options,registry]=await Promise.all([id?request('/talk-records/'+encodeURIComponent(id)):Promise.resolve(null),metadata?Promise.resolve(metadata):request('/talk-records/options'),state.user.role==='counselor'&&!id?request('/registry/students'):Promise.resolve([])])
   if(state.epoch!==epoch||state.user?.id!==userId)return
   metadata=options;students=registry;formDialog(record)
  }
  function formDialog(record){
   dirty=false
   const r=record||{},admin=state.user.role==='admin',requestId=globalThis.crypto?.randomUUID?.()||('talk_'+Date.now()+'_'+Math.random().toString(36).slice(2))
   openDialog(dialogHead(admin?'查看学生谈话表':r.id?'编辑学生谈话记录':'新建学生谈话记录',admin?'管理员可以查看所有辅导员的记录。':'可先保存未完成内容；导出与打印前需保存最新修改。')+`${r.id?`<div class="talk-times"><span>首次保存：${h(time(r.createdAt))}</span><span>最后修改：${h(time(r.updatedAt))}</span><span>记录人：${h(r.counselorName)}</span></div>`:''}<form id="talk-form"><fieldset ${admin?'disabled':''}>${!r.id?`<label>从学生档案带入（选填）<select name="registryStudentId"><option value="">手动填写学生信息</option>${students.map(s=>`<option value="${h(s.id)}">${h(s.name)} · ${h(s.college)}${s.studentNo?' · '+h(s.studentNo):''}</option>`).join('')}</select></label>`:''}<div class="form-grid">${field('姓名 *','name',r.name,'required maxlength="50"')}${field('性别','gender',r.gender,'maxlength="10"')}${field('学院','college',r.college,'maxlength="100"')}${field('学号（平台核对用，不加入原表）','studentNo',r.studentNo,'maxlength="50"')}${field('年级专业班级','gradeClass',r.gradeClass,'maxlength="200" placeholder="请填写年级、专业和班级"')}${field('谈话日期','talkDate',r.talkDate||today(),'type="date"')}</div><section class="talk-issues"><h3>近期心理困扰</h3><div class="issue-options">${metadata.issues.map((label,i)=>`<label class="check-line"><input type="checkbox" name="issues" value="${i+1}" ${r.issues?.includes(i+1)?'checked':''}>${i+1}. ${h(label)}</label>`).join('')}</div><label id="other-issue-label" ${r.issues?.includes(9)?'':'hidden'}>其他困扰<input name="otherIssue" maxlength="200" value="${h(r.otherIssue)}"></label></section><label>具体谈话内容<textarea name="content" rows="9" maxlength="10000" placeholder="记录本次谈话的实际内容，可先保存后继续修改。">${h(r.content)}</textarea></label></fieldset><p id="talk-content-count" class="muted small"></p><p class="muted small talk-print-note">学校原表预留5行谈话内容。长记录可保存，打印前需精简到原表容量；不会截断文字或缩小字体。辅导员、学生签名栏留空手写。</p><p class="muted small">${h(metadata.fontNotice)}</p><div id="talk-save-state" role="status" class="talk-save-state">${admin?'查看模式，原记录由辅导员维护。':r.id?'当前显示已保存版本。':'尚未保存。'}</div><div class="dialog-actions talk-actions">${button('关闭','talk-cancel','ghost')}${r.id?button('导出 Word (.doc)','talk-word')+button('导出 PDF','talk-pdf')+button('预览 / 打印','talk-preview'):''}${admin?'':'<button class="button primary" type="submit">保存记录</button>'}</div></form>`)
   watchClose()
   const form=document.getElementById('talk-form'),count=document.getElementById('talk-content-count')
   count.textContent=`已填写 ${form.elements.content.value.length} 字符。`
   if(!admin){
    form.oninput=()=>{dirty=true;count.textContent=`已填写 ${form.elements.content.value.length} 字符。`;document.getElementById('talk-save-state').textContent='有未保存修改，请先保存再打印或导出。';['talk-word','talk-pdf','talk-preview'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=true})}
    form.onchange=e=>{if(e.target.name==='issues'){const other=!!form.querySelector('[name=issues][value="9"]:checked');document.getElementById('other-issue-label').hidden=!other;if(!other)form.elements.otherIssue.value=''}if(e.target.name==='registryStudentId'){const s=students.find(s=>s.id===e.target.value);if(s){for(const [key,v]of Object.entries({name:s.name,gender:s.gender,college:s.college,studentNo:s.studentNo,gradeClass:s.gradeMajor}))form.elements[key].value=v}form.oninput()}}
    form.onsubmit=busy(form,async()=>{const input=Object.fromEntries(new FormData(form));input.issues=Array.from(form.querySelectorAll('[name=issues]:checked')).map(c=>Number(c.value));if(r.id)input.revision=r.revision;else input.clientRequestId=requestId;const userId=state.user.id,epoch=state.epoch;const saved=await request('/talk-records'+(r.id?'/'+r.id:''),json(r.id?'PATCH':'POST',input));if(state.user?.id!==userId)return;if(state.page==='talks'&&state.epoch===epoch&&modal.open&&document.getElementById('talk-form')===form){dirty=false;await page();formDialog(saved)}notice('谈话记录已保存')})
   }
   if(r.id){document.getElementById('talk-word').onclick=e=>download(r,'doc',e.target);document.getElementById('talk-pdf').onclick=e=>download(r,'pdf',e.target);document.getElementById('talk-preview').onclick=e=>preview(r,e.target)}
  }
  async function download(r,format,b){b.disabled=true;const userId=state.user.id,epoch=state.epoch;try{const blob=await request(recordUrl(r,format),{binary:true});if(state.user?.id!==userId||state.epoch!==epoch)return;const url=URL.createObjectURL(blob);urls.push(url);const a=document.createElement('a');a.href=url;a.download='辅导员心理谈话表-'+r.name+'-'+r.talkDate+'.'+format;a.click();notice('谈话表已导出')}catch(e){notice(e.message,true)}finally{b.disabled=false}}
  async function preview(r,b){
   b.disabled=true;const epoch=state.epoch,userId=state.user.id
   try{const blob=await request(recordUrl(r,'pdf',{purpose:'print',preview:'1'}),{binary:true});if(state.epoch!==epoch||state.user?.id!==userId)return;const url=URL.createObjectURL(blob);urls.push(url);dirty=false
    openDialog(dialogHead('谈话表预览 / 打印','以下为实际导出的 PDF。打印时选择 A4、实际大小，使用 PDF 自带打印按钮。')+`<iframe id="talk-pdf-frame" class="talk-pdf-frame" title="学校原格式谈话表预览" src="${h(url)}"></iframe><p class="muted small">${h(metadata.fontNotice)}</p><div class="dialog-actions">${button('返回记录','talk-back','ghost')}<button type="button" class="button primary" id="talk-print-window">打开 PDF 打印</button></div>`)
    watchClose();document.getElementById('talk-back').onclick=()=>formDialog(r);document.getElementById('talk-print-window').onclick=()=>{const win=window.open(url,'_blank');if(!win)notice('请允许弹出窗口，或使用预览中的打印按钮',true)}
   }catch(e){notice(e.message,true)}finally{b.disabled=false}
  }
  return {page,open,cleanup}
 }
})()
