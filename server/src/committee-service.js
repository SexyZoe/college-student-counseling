const {requireDataWriter}=require('./business-permissions')
const crypto=require('node:crypto')
const {HttpError}=require('./errors')
const {inTransaction}=require('./database')
const {writeCommitteeExport,writeCommitteeWorkbook}=require('./committee-workbook')
const {createWorkbookPreviewRenderer}=require('./workbook-preview')
const JSZip=require('jszip')
const HEADER_FIELDS={schoolTeacherName:50,schoolTeacherContact:100,collegeLeaderName:50,collegeLeaderContact:100}
function object(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(422,'COMMITTEE_INPUT_INVALID','请提交有效的表单内容');return input}
function text(value,max,label,required=false){if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw new HttpError(422,'COMMITTEE_FIELD_INVALID',label+'格式不正确或过长');const v=value.trim();if(required&&!v)throw new HttpError(422,'COMMITTEE_REQUIRED','请填写'+label);return v}
function createCommitteeServices(db,context){
 const {requireRole,nowIso,audit,dataProtector}=context,lock=db.dialect==='mysql'?' FOR UPDATE':''
 const previewRenderer=createWorkbookPreviewRenderer(context.config||{})
 const staff=u=>requireRole(u,['admin','counselor'])
 async function semester(id){if(id!==undefined&&id!==''&&typeof id!=='string')throw new HttpError(422,'COMMITTEE_SEMESTER_REQUIRED','请选择有效的学期');const row=id?await db.prepare('SELECT * FROM semesters WHERE id=?').get(id):await db.prepare("SELECT * FROM semesters WHERE status='当前学期' LIMIT 1").get();if(!row)throw new HttpError(422,'COMMITTEE_SEMESTER_REQUIRED','请选择已建立的学期');return row}
 async function owner(user,id){
  const requested=id||user.id
  if(typeof requested!=='string'||requested.length>80)throw new HttpError(422,'COMMITTEE_OWNER_REQUIRED','请选择有效的负责辅导员')
  if(user.role==='counselor'&&requested!==user.id)throw new HttpError(403,'FORBIDDEN','只能管理本人负责的班级')
  const row=await db.prepare("SELECT id,display_name FROM users WHERE id=? AND role='counselor' AND active=1").get(requested)
  if(!row)throw new HttpError(422,'COMMITTEE_OWNER_REQUIRED','请选择已启用的辅导员');return row
 }
 function unpackMember(row){return {...dataProtector.unprotectJson(row.record_json,'committee-member:'+row.id),id:row.id,classId:row.class_id,revision:Number(row.revision),createdAt:row.created_at,updatedAt:row.updated_at}}
 function unpackClass(row){return {id:row.id,semesterId:row.semester_id,counselorId:row.counselor_user_id,counselorName:row.counselor_name,college:row.college,campus:row.campus,name:row.name,active:!!row.active,revision:Number(row.revision),createdAt:row.created_at,updatedAt:row.updated_at}}
 async function rawClass(user,id,locking=false){
  staff(user);const row=await db.prepare('SELECT c.*,u.display_name AS counselor_name FROM committee_classes c JOIN users u ON u.id=c.counselor_user_id WHERE c.id=?'+(locking?lock:'')).get(id)
  if(!row||(user.role==='counselor'&&row.counselor_user_id!==user.id))throw new HttpError(404,'COMMITTEE_CLASS_NOT_FOUND','班级不存在或无权访问');return row
 }
 async function members(id){return (await db.prepare('SELECT * FROM committee_members WHERE class_id=? ORDER BY created_at,id').all(id)).map(unpackMember)}
 async function detail(user,id){const row=await rawClass(user,id);return {...unpackClass(row),headers:(await headersFor([row.college],row.counselor_user_id))[row.college],members:await members(id)}}
 async function headersFor(colleges,counselorId){
  const result={};for(const college of colleges){
   const own=counselorId?await db.prepare('SELECT * FROM committee_counselor_headers WHERE counselor_user_id=? AND college=?').get(counselorId,college):null
   const legacy=own?null:await db.prepare('SELECT * FROM committee_colleges WHERE college=?').get(college)
   const empty={schoolTeacherName:'',schoolTeacherContact:'',collegeLeaderName:'',collegeLeaderContact:''}
   result[college]={...(own?dataProtector.unprotectJson(own.record_json,'committee-header:'+counselorId+':'+college):legacy?dataProtector.unprotectJson(legacy.record_json,'committee-college:'+college):empty),revision:own?Number(own.revision):0}
  }return result
 }
 async function list(user,filters={}){
  staff(user);object(filters);for(const key of ['q','college','campus','counselorId','classId'])if(filters[key]!==undefined)text(filters[key],key==='q'?500:150,'查询条件');const term=await semester(filters.semesterId),args=[term.id],where=['c.semester_id=?']
  if(user.role==='counselor'){where.push('c.counselor_user_id=?');args.push(user.id)}else if(filters.counselorId){where.push('c.counselor_user_id=?');args.push(filters.counselorId)}
  if(filters.includeArchived!==true&&filters.includeArchived!=='1')where.push('c.active=1')
  for(const key of ['college','campus'])if(filters[key]){where.push('c.'+key+'=?');args.push(filters[key])}
  if(filters.classId){where.push('c.id=?');args.push(filters.classId)}
  const status=filters.memberStatus||'active';if(!['active','former','all'].includes(status))throw new HttpError(422,'COMMITTEE_STATUS_INVALID','请选择有效的任职状态')
  const raw=await db.prepare('SELECT c.*,u.display_name AS counselor_name FROM committee_classes c JOIN users u ON u.id=c.counselor_user_id WHERE '+where.join(' AND ')).all(...args)
  const q=String(filters.q||'').trim().toLowerCase(),classes=[]
  // One scoped query avoids loading other counselors' contacts into memory.
  const memberRows=await db.prepare('SELECT m.* FROM committee_members m JOIN committee_classes c ON c.id=m.class_id WHERE '+where.join(' AND ')).all(...args)
  const byClass=new Map();for(const row of memberRows){if(!byClass.has(row.class_id))byClass.set(row.class_id,[]);byClass.get(row.class_id).push(unpackMember(row))}
  for(const row of raw){const c=unpackClass(row),all=byClass.get(c.id)||[],classMatch=!q||[c.name,c.college,c.campus,c.counselorName].some(v=>v.toLowerCase().includes(q));c.members=all.filter(m=>(status==='all'||m.status===status)&&(classMatch||[m.name,m.phone,m.studentNo].some(v=>v.toLowerCase().includes(q)))).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')||a.id.localeCompare(b.id));c.activeMembers=all.filter(m=>m.status==='active').length;c.totalMembers=all.length;if(classMatch||c.members.length)classes.push(c)}
  classes.sort((a,b)=>a.college.localeCompare(b.college,'zh-CN')||a.campus.localeCompare(b.campus,'zh-CN')||a.counselorName.localeCompare(b.counselorName,'zh-CN')||a.counselorId.localeCompare(b.counselorId)||a.name.localeCompare(b.name,'zh-CN')||a.id.localeCompare(b.id))
  const headerCache=new Map();for(const c of classes){const key=JSON.stringify([c.college,c.counselorId]);if(!headerCache.has(key))headerCache.set(key,(await headersFor([c.college],c.counselorId))[c.college]);c.headers=headerCache.get(key)}
  return {semesterId:term.id,semesterName:term.name,classes,headers:await headersFor([...new Set(classes.map(c=>c.college))],user.role==='counselor'?user.id:filters.counselorId),counts:{classes:classes.length,members:classes.reduce((n,c)=>n+c.members.length,0),missing:classes.filter(c=>c.activeMembers===0&&c.active).length}}
 }
 async function saveClass(user,input,id){requireDataWriter(user);object(input)
  const values={college:text(input.college??'',100,'学院',true),campus:text(input.campus??'',100,'校区',true),name:text(input.name??'',150,'年级专业班级',true)}
  return inTransaction(db,async()=>{
   const old=id?await rawClass(user,id,true):null,term=await semester(input.semesterId||old?.semester_id)
   if(old&&term.id!==old.semester_id)throw new HttpError(422,'COMMITTEE_SEMESTER_FIXED','班级不能移动到其他学期，请使用“沿用到新学期”')
   const responsible=await owner(user,input.counselorId||old?.counselor_user_id)
   if(old&&old.counselor_user_id!==responsible.id&&term.status==='已归档')throw new HttpError(409,'COMMITTEE_HISTORICAL_OWNER','历史学期的负责辅导员保持不变，请在新学期调整归属')
   if(old&&input.revision!==Number(old.revision))throw new HttpError(409,'COMMITTEE_CHANGED','班级已更新，请重新打开后编辑')
   if(input.active!==undefined&&typeof input.active!=='boolean')throw new HttpError(422,'COMMITTEE_FIELD_INVALID','班级状态格式不正确')
   const active=input.active===undefined?(old?Number(old.active):1):(input.active?1:0),now=nowIso(),classId=id||crypto.randomUUID()
   try{
    if(old)await db.prepare('UPDATE committee_classes SET college=?,campus=?,name=?,counselor_user_id=?,active=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(values.college,values.campus,values.name,responsible.id,active,now,classId,input.revision)
    else await db.prepare('INSERT INTO committee_classes(id,semester_id,counselor_user_id,college,campus,name,active,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)').run(classId,term.id,responsible.id,values.college,values.campus,values.name,active,now,now)
   }catch(e){if(e.code==='ER_DUP_ENTRY'||/UNIQUE constraint failed/.test(e.message))throw new HttpError(409,'COMMITTEE_CLASS_EXISTS','该学期同学院、校区和名称的班级已存在，请核对班级归属');throw e}
   await audit(user.id,old?'修改心理委员班级':'创建心理委员班级','committee_class',classId,{semesterId:term.id,counselorId:responsible.id,active})
   return detail(user,classId)
  })
 }
 async function saveMember(user,classId,input,id){
  requireRole(user,'counselor');object(input)
  const value={name:text(input.name??'',50,'心理委员姓名',true),gender:text(input.gender??'',10,'性别'),phone:text(input.phone??'',100,'联系方式'),studentNo:text(input.studentNo??'',50,'学号'),status:input.status||'active'}
  if(!['active','former'].includes(value.status)||!['','男','女','其他','未填写'].includes(value.gender))throw new HttpError(422,'COMMITTEE_STATUS_INVALID','性别或任职状态格式不正确')
  return inTransaction(db,async()=>{
   const c=await rawClass(user,classId,true);if(!c.active)throw new HttpError(422,'COMMITTEE_CLASS_ARCHIVED','该班级已停用，请先恢复班级')
   const old=id?await db.prepare('SELECT * FROM committee_members WHERE id=? AND class_id=?').get(id,classId):null
   if(id&&!old)throw new HttpError(404,'COMMITTEE_MEMBER_NOT_FOUND','心理委员记录不存在')
   if(old&&input.revision!==Number(old.revision))throw new HttpError(409,'COMMITTEE_CHANGED','心理委员记录已更新，请重新打开后编辑')
   if(value.status==='active')for(const m of await members(classId))if(m.id!==id&&m.status==='active'&&((m.studentNo&&value.studentNo&&m.studentNo===value.studentNo)||((!m.studentNo||!value.studentNo)&&m.name===value.name&&m.phone===value.phone)))throw new HttpError(409,'COMMITTEE_MEMBER_EXISTS','该委员已在本班任职；同名学生请补充不同的学号或联系方式核对')
   const memberId=id||crypto.randomUUID(),now=nowIso(),protectedData=dataProtector.protectJson(value,'committee-member:'+memberId)
   if(old)await db.prepare('UPDATE committee_members SET record_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(protectedData,now,memberId,input.revision)
   else await db.prepare('INSERT INTO committee_members(id,class_id,record_json,revision,created_at,updated_at) VALUES(?,?,?,1,?,?)').run(memberId,classId,protectedData,now,now)
   await audit(user.id,old?'修改班级心理委员':'添加班级心理委员','committee_member',memberId,{classId,status:value.status})
   return unpackMember(await db.prepare('SELECT * FROM committee_members WHERE id=?').get(memberId))
  })
 }
 async function copyClass(user,id,input){requireDataWriter(user);object(input)
  return inTransaction(db,async()=>{
   const old=await rawClass(user,id,true),term=await semester(input.semesterId)
   if(term.id===old.semester_id)throw new HttpError(422,'COMMITTEE_COPY_SAME','请选择其他学期，当前学期已有此班级')
   const all=await members(id),created=await saveClass(user,{college:old.college,campus:old.campus,name:old.name,semesterId:term.id,counselorId:input.counselorId||old.counselor_user_id})
   for(const m of all.filter(m=>m.status==='active')){const memberId=crypto.randomUUID(),now=nowIso(),value={name:m.name,gender:m.gender,phone:m.phone,studentNo:m.studentNo,status:'active'};await db.prepare('INSERT INTO committee_members(id,class_id,record_json,revision,created_at,updated_at) VALUES(?,?,?,1,?,?)').run(memberId,created.id,dataProtector.protectJson(value,'committee-member:'+memberId),now,now)}
   await audit(user.id,'沿用心理委员到其他学期','committee_class',created.id,{sourceClassId:id,semesterId:term.id,count:all.filter(m=>m.status==='active').length})
   return detail(user,created.id)
  })
 }
 async function saveHeaders(user,input){
  requireDataWriter(user);object(input);const college=text(input.college??'',100,'学院',true),value={}
  for(const [key,max]of Object.entries(HEADER_FIELDS))value[key]=text(input[key]??'',max,'负责人信息')
  return inTransaction(db,async()=>{
   await db.prepare('SELECT id FROM users WHERE id=?'+lock).get(user.id)
   if(!await db.prepare('SELECT id FROM committee_classes WHERE counselor_user_id=? AND college=? LIMIT 1').get(user.id,college))throw new HttpError(403,'FORBIDDEN','只能设置本人负责班级的原表表头')
   const old=await db.prepare('SELECT * FROM committee_counselor_headers WHERE counselor_user_id=? AND college=?').get(user.id,college)
   if(input.revision!==(old?Number(old.revision):0))throw new HttpError(409,'COMMITTEE_CHANGED','表头已更新，请重新打开后编辑')
   const protectedData=dataProtector.protectJson(value,'committee-header:'+user.id+':'+college)
   if(old)await db.prepare('UPDATE committee_counselor_headers SET record_json=?,revision=revision+1,updated_at=? WHERE counselor_user_id=? AND college=?').run(protectedData,nowIso(),user.id,college)
   else await db.prepare('INSERT INTO committee_counselor_headers(counselor_user_id,college,record_json,revision,updated_at) VALUES(?,?,?,1,?)').run(user.id,college,protectedData,nowIso())
   await audit(user.id,'设置本人心理委员原表表头','committee_college',college,{})
   return (await headersFor([college],user.id))[college]
  })
 }
 async function exportData(user,filters={}){
  const data=await list(user,filters)
  const rows=[];for(const c of data.classes){const base={college:c.college,campus:c.campus,counselorId:c.counselorId,counselorName:c.counselorName,classId:c.id,className:c.name,exportHeaders:c.headers};if(!c.members.length){if((filters.memberStatus||'active')==='active')rows.push({...base,name:'',gender:'',phone:'',status:'active'})}else for(const m of c.members)rows.push({...base,...m})}
  const files=new Map()
  for(const row of rows){const key=JSON.stringify([data.semesterId,row.counselorId,row.college]),id=crypto.createHash('sha256').update(key).digest('hex');if(!files.has(id))files.set(id,{id,counselorId:row.counselorId,counselorName:row.counselorName,college:row.college,headers:row.exportHeaders,rows:[]});files.get(id).rows.push(row)}
  for(const f of files.values()){
   f.version=crypto.createHash('sha256').update(JSON.stringify([f.headers,f.rows])).digest('hex')
   f.classCount=new Set(f.rows.map(r=>r.classId)).size;f.memberCount=f.rows.filter(r=>r.name).length;f.campuses=[...new Set(f.rows.map(r=>r.campus))]
   f.fileName=[f.counselorName,f.college,'心理危机四级预警网络',data.semesterName].join('-').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,180)+'.xlsx'
  }
  return {data,rows,files}
 }
 const publicFile=f=>({id:f.id,version:f.version,counselorId:f.counselorId,counselorName:f.counselorName,college:f.college,campuses:f.campuses,classCount:f.classCount,memberCount:f.memberCount,fileName:f.fileName})
 async function exportOptions(user,filters={}){const {data,files}=await exportData(user,filters);return {semesterId:data.semesterId,semesterName:data.semesterName,files:[...files.values()].map(publicFile)}}
 function selectedFiles(files,input){
  if(!Array.isArray(input.fileIds)||!input.fileIds.length||input.fileIds.length>100||input.fileIds.some(id=>typeof id!=='string')||new Set(input.fileIds).size!==input.fileIds.length)throw new HttpError(422,'COMMITTEE_EXPORT_SELECTION','请选择 1—100 份不同的表格')
  const selected=input.fileIds.map(id=>{const f=files.get(id);if(!f)throw new HttpError(404,'COMMITTEE_EXPORT_NOT_FOUND','所选表格不存在或超出当前查询范围，请重新打开导出窗口');return f})
  if(!input.versions||typeof input.versions!=='object'||Array.isArray(input.versions)||selected.some(f=>input.versions[f.id]!==f.version))throw new HttpError(409,'COMMITTEE_EXPORT_CHANGED','老师保存的数据已更新，请重新载入导出列表后预览与下载')
  return selected
 }
 async function previewExport(user,input){
  const {files}=await exportData(user,input),selected=selectedFiles(files,input)
  if(selected.length!==1)throw new HttpError(422,'COMMITTEE_PREVIEW_SELECTION','每次请选择一份表格预览')
  const f=selected[0],buffer=await writeCommitteeWorkbook(f.college,f.rows,f.headers),result=await previewRenderer.render(buffer)
  await audit(user.id,'预览心理委员学校原表','committee_export',f.id,{counselorId:f.counselorId,classes:f.classCount,rows:f.rows.length})
  return {...result,file:publicFile(f)}
 }
 async function report(user,filters={}){
  const {data,rows,files}=await exportData(user,filters)
  let result,exported=rows
  if(filters.fileIds!==undefined){
   const selected=selectedFiles(files,filters);exported=selected.flatMap(f=>f.rows)
   if(selected.length===1){const f=selected[0];result={buffer:await writeCommitteeWorkbook(f.college,f.rows,f.headers),fileName:f.fileName,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}
   else{const zip=new JSZip();for(const [i,f]of selected.entries())zip.file(String(i+1).padStart(2,'0')+'-'+f.fileName,await writeCommitteeWorkbook(f.college,f.rows,f.headers));result={buffer:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),fileName:'心理委员所选表格-'+data.semesterName+'.zip',mimeType:'application/zip'}}
  }else{
   if(!rows.length)throw new HttpError(422,'COMMITTEE_EXPORT_EMPTY','当前范围没有可导出的班级或委员记录')
   result=await writeCommitteeExport(rows,data.headers,data.semesterName)
  }
  await audit(user.id,'导出心理危机四级预警网络原表','committee_export','',{semesterId:data.semesterId,classes:new Set(exported.map(r=>r.classId)).size,rows:exported.length,colleges:new Set(exported.map(r=>r.college)).size,files:filters.fileIds?.length})
  return result
 }

 return {listCommitteeClasses:list,getCommitteeClass:detail,saveCommitteeClass:saveClass,saveCommitteeMember:saveMember,copyCommitteeClass:copyClass,saveCommitteeHeaders:saveHeaders,exportCommitteeWorkbook:report,getCommitteeExportOptions:exportOptions,previewCommitteeExport:previewExport}
}
module.exports={createCommitteeServices}
