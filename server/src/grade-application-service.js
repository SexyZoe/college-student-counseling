const {requireDataWriter}=require('./business-permissions')
const crypto=require('node:crypto')
const {HttpError}=require('./errors')
const {inTransaction}=require('./database')
const {validDate}=require('./registry-levels')
const {createGradeDocumentRenderer,checkGradePrintable}=require('./grade-document')
const LEVELS=['一级','二级','三级','四级']
const FIELDS={registryStudentId:80,name:50,college:100,grade:50,major:150,entryDate:10,entryLevel:20,currentLevel:20,kind:10,targetLevel:20,remarks:500,reason:2000}
function object(v){if(!v||typeof v!=='object'||Array.isArray(v))throw new HttpError(422,'APPLICATION_INPUT','请提交有效的表单');return v}
function text(v,max,label){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new HttpError(422,'APPLICATION_FIELD',label+'格式不正确或过长');return v.trim()}
const chinaDate=v=>new Date(v).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})
function createGradeApplicationServices(db,config,context){
 const {requireRole,nowIso,audit,dataProtector,getRegistryStudent}=context,renderer=createGradeDocumentRenderer(config),lock=db.dialect==='mysql'?' FOR UPDATE':''
 const staff=u=>requireRole(u,['admin','counselor'])
 const fail=(code,msg,status=422)=>{throw new HttpError(status,code,msg)}
 function unpack(r){return {...dataProtector.unprotectJson(r.record_json,'grade-application:'+r.id),id:r.id,semesterId:r.semester_id,semesterName:r.semester_name,counselorId:r.counselor_user_id,counselorName:r.counselor_name,createdByName:r.creator_name,status:r.status,revision:Number(r.revision),createdAt:r.created_at,updatedAt:r.updated_at,submittedAt:r.submitted_at}}
 const select='SELECT a.*,s.name AS semester_name,u.display_name AS counselor_name,c.display_name AS creator_name FROM grade_applications a JOIN semesters s ON s.id=a.semester_id JOIN users u ON u.id=a.counselor_user_id JOIN users c ON c.id=a.created_by_user_id'
 async function raw(user,id,locking=false){staff(user);const r=await db.prepare(select+' WHERE a.id=?'+(locking?lock:'')).get(id);if(!r||(user.role==='counselor'&&r.counselor_user_id!==user.id))fail('APPLICATION_NOT_FOUND','申请记录不存在或无权访问',404);return r}
 async function detail(user,id){return unpack(await raw(user,id))}
 async function list(user,f={}){
  staff(user);object(f);for(const k of ['semesterId','counselorId','status','q','from','to'])if(f[k]!==undefined)text(f[k],k==='q'?200:80,'查询条件')
  for(const k of ['from','to'])if(f[k]&&!validDate(f[k]))fail('APPLICATION_DATE','请选择有效日期');if(f.from&&f.to&&f.from>f.to)fail('APPLICATION_DATE','开始日期不能晚于结束日期')
  if(f.status&&!['draft','submitted'].includes(f.status))fail('APPLICATION_STATUS','申请状态无效')
  const w=[],args=[];if(user.role==='counselor'){w.push('a.counselor_user_id=?');args.push(user.id)}else if(f.counselorId){w.push('a.counselor_user_id=?');args.push(f.counselorId)}
  for(const [key,column]of [['semesterId','semester_id'],['status','status']])if(f[key]){w.push('a.'+column+'=?');args.push(f[key])}
  const q=(f.q||'').toLowerCase();return (await db.prepare(select+(w.length?' WHERE '+w.join(' AND '):'')+' ORDER BY a.updated_at DESC,a.id').all(...args)).map(unpack).filter(r=>(!f.from||chinaDate(r.createdAt)>=f.from)&&(!f.to||chinaDate(r.createdAt)<=f.to)&&(!q||[r.counselorName,...r.entries.flatMap(e=>[e.name,e.college,e.major])].some(v=>v.toLowerCase().includes(q))))
 }
 async function normalize(user,input,ownerId,strict){
  if(!Array.isArray(input.entries)||input.entries.length<1||input.entries.length>30)fail('APPLICATION_ENTRIES','每份申请请填写 1—30 名学生，每页按原表容纳 3 名')
  const entries=[],seen=new Set(),today=chinaDate(nowIso())
  for(const source of input.entries){object(source);const e={};for(const [k,max]of Object.entries(FIELDS))e[k]=text(source[k]??'',max,k)
   if(e.registryStudentId){const r=await getRegistryStudent(user,e.registryStudentId);if(r.counselorId!==ownerId)fail('APPLICATION_STUDENT_OWNER','所选学生不属于本申请的负责辅导员');if(seen.has(r.id))fail('APPLICATION_DUPLICATE','同一申请不能重复填写同一学生');seen.add(r.id)}
   if(e.entryDate&&(!validDate(e.entryDate)||e.entryDate>today))fail('APPLICATION_DATE','进库日期必须为有效日期，且不能晚于今天')
   if(e.kind&&!['downgrade','exit'].includes(e.kind))fail('APPLICATION_KIND','请选择降级或出库')
   for(const k of ['entryLevel','currentLevel','targetLevel'])if(e[k]&&!LEVELS.includes(e[k]))fail('APPLICATION_LEVEL','请选择原表对应的一级至四级')
   if(e.kind==='exit')e.targetLevel=''
   if(strict){for(const k of ['registryStudentId','name','college','grade','major','entryDate','entryLevel','currentLevel','kind','reason'])if(!e[k])fail('APPLICATION_REQUIRED','请补全每名学生的档案关联、身份、进库信息、现等级、申请事项和等级变动理由')
    if(e.kind==='downgrade'&&(!e.targetLevel||LEVELS.indexOf(e.targetLevel)<=LEVELS.indexOf(e.currentLevel)))fail('APPLICATION_TARGET','降级后的等级应低于现等级（一级风险最高）')
   }entries.push(e)
  }
  if(new Set(entries.map(e=>e.college).filter(Boolean)).size>1)fail('APPLICATION_COLLEGE','一份申请对应一个学院的盖章，请按学院分别建立申请')
  return {entries}
 }
 async function persist(user,old,value,status,extra={}){
  const id=old?.id||crypto.randomUUID(),now=nowIso(),revision=(old?Number(old.revision):0)+1,body={...value},enc=dataProtector.protectJson(body,'grade-application:'+id)
  if(old)await db.prepare('UPDATE grade_applications SET record_json=?,status=?,revision=?,submitted_at=?,updated_at=? WHERE id=? AND revision=?').run(enc,status,revision,extra.submittedAt??old.submitted_at,now,id,old.revision)
  else await db.prepare('INSERT INTO grade_applications(id,semester_id,counselor_user_id,created_by_user_id,client_request_id,record_json,status,revision,submitted_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,extra.semesterId,extra.ownerId,user.id,extra.clientRequestId,enc,status,revision,status==='submitted'?now:null,now,now)
  const snapshot={...body,status,submittedAt:extra.submittedAt??old?.submitted_at??(status==='submitted'?now:null)}
  await db.prepare('INSERT INTO grade_application_versions(application_id,revision,record_json,actor_user_id,created_at) VALUES(?,?,?,?,?)').run(id,revision,dataProtector.protectJson(snapshot,'grade-version:'+id+':'+revision),user.id,now)
  await audit(user.id,'保存降级出库申请','grade_application',id,{revision,status})
  return detail(user,id)
 }
 async function save(user,input,id){requireDataWriter(user);object(input);return inTransaction(db,async()=>{
  const old=id?await raw(user,id,true):null;if(old&&input.revision!==Number(old.revision))fail('APPLICATION_CHANGED','记录已更新，请重新打开后编辑',409)

  const ownerId=old?.counselor_user_id||input.counselorId||user.id
  if(typeof ownerId!=='string'||(user.role==='counselor'&&ownerId!==user.id))fail('FORBIDDEN','只能填写本人负责学生的申请',403)
  if(!await db.prepare("SELECT id FROM users WHERE id=? AND role='counselor' AND active=1").get(ownerId))fail('APPLICATION_OWNER','请选择已启用的负责辅导员')
  const semesterId=old?.semester_id||input.semesterId;if(typeof semesterId!=='string'||!await db.prepare('SELECT id FROM semesters WHERE id=?').get(semesterId))fail('APPLICATION_SEMESTER','请选择已建立的学期')
  const status=input.status||'draft';if(!['draft','submitted'].includes(status))fail('APPLICATION_STATUS','只能保存草稿或提交申请')
  const value=await normalize(user,input,ownerId,status==='submitted');value.centerOpinion=text(input.centerOpinion??'',1000,'心理中心评估后意见');value.signatureDate=text(input.signatureDate??'',10,'签章日期');if(value.signatureDate&&!validDate(value.signatureDate))fail('APPLICATION_DATE','请填写有效的签章日期')
  const clientRequestId=old?.client_request_id||text(input.clientRequestId??'',80,'请求标识');if(!/^[a-zA-Z0-9_-]{8,80}$/.test(clientRequestId))fail('APPLICATION_REQUEST_ID','请刷新后重试保存')
  if(!old){const duplicate=await db.prepare('SELECT id FROM grade_applications WHERE created_by_user_id=? AND client_request_id=?').get(user.id,clientRequestId);if(duplicate){const prior=await detail(user,duplicate.id);if(prior.semesterId!==semesterId||prior.counselorId!==ownerId||prior.status!==status||JSON.stringify(prior.entries)!==JSON.stringify(value.entries)||prior.centerOpinion!==value.centerOpinion||prior.signatureDate!==value.signatureDate)fail('APPLICATION_RETRY_CHANGED','上一次保存已成功，请重新打开记录后修改，避免重复建表',409);return prior}}
  return persist(user,old,value,status,{ownerId,semesterId,clientRequestId,submittedAt:status==='submitted'?nowIso():undefined})
 })}
 async function versions(user,id){await raw(user,id);return (await db.prepare('SELECT v.*,u.display_name AS actor_name FROM grade_application_versions v JOIN users u ON u.id=v.actor_user_id WHERE v.application_id=? ORDER BY v.revision DESC').all(id)).map(r=>({revision:Number(r.revision),actorName:r.actor_name,createdAt:r.created_at,...dataProtector.unprotectJson(r.record_json,'grade-version:'+id+':'+r.revision)}))}
 async function document(user,id,f={}){const record=await detail(user,id);if(String(f.revision)!==String(record.revision))fail('APPLICATION_CHANGED','打印前请重新打开最新记录',409);if(record.status!=='submitted')fail('APPLICATION_INCOMPLETE','请先保存完整表格，再预览、打印或导出');if(!['pdf','xlsx','preview'].includes(f.format||'pdf'))fail('APPLICATION_FORMAT','仅支持 PDF、Excel 原表或打印预览')
  const result=await renderer.render(record,f.format||'pdf');await audit(user.id,'导出降级出库学校原表','grade_application',id,{revision:record.revision,format:f.format||'pdf'});return {...result,fileName:'心理问题学生降级、出库申请表.'+(f.format||'pdf')}
 }

 return {listGradeApplications:list,getGradeApplication:detail,saveGradeApplication:save,getGradeApplicationVersions:versions,exportGradeApplication:document,getGradePrintCheck:checkGradePrintable}
}
module.exports={createGradeApplicationServices,chinaDate}
