const crypto=require('node:crypto')
const {HttpError}=require('./errors')
const {inTransaction}=require('./database')
const {validDate,weeklyLevel}=require('./registry-levels')
const {writeWeeklyWorkbook,WEEKLY_HEADERS}=require('./weekly-workbook')
const {day,monday,validateFirstMonday}=require('./academic-calendar')
const label=p=>`${p.weekStart.slice(0,4)}年${Number(p.weekStart.slice(5,7))}月${Number(p.weekStart.slice(8))}日—${p.weekEnd.slice(0,4)}年${Number(p.weekEnd.slice(5,7))}月${Number(p.weekEnd.slice(8))}日（第${p.weekNumber}周${p.calendarConfigured===false?'，默认推算':''}）`
function text(value,max,name){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new HttpError(422,'WEEKLY_FIELD_INVALID',name+'格式不正确或过长');return value.trim().replace(/\r\n?/g,'\n')}
function createWeeklyServices(database,context){
 const {requireRole,audit,nowIso,dataProtector,listRegistryStudents,getRegistryStudent}=context
 const staff=u=>requireRole(u,['admin','counselor'])
 async function options(user){
  staff(user)
  const rows=await database.prepare('SELECT s.*,c.first_monday,EXISTS(SELECT 1 FROM weekly_records w WHERE w.semester_id=s.id) AS has_records FROM semesters s LEFT JOIN weekly_calendars c ON c.semester_id=s.id ORDER BY s.start_date DESC').all()
  return {demo:context.demoMode===true,semesters:rows.map(s=>({id:s.id,name:s.name,startDate:s.start_date,endDate:s.end_date,status:s.status,current:s.status==='当前学期',firstMonday:s.first_monday||monday(s.start_date),calendarConfigured:!!s.first_monday,hasRecords:!!s.has_records})),headers:WEEKLY_HEADERS}
 }
 async function period(user,filters){
  const meta=await options(user),semester=meta.semesters.find(s=>s.id===filters.semesterId)
  if(!semester)throw new HttpError(422,'WEEKLY_SEMESTER_REQUIRED','请选择学期')
  const start=filters.weekStart
  if(!validDate(start)||monday(start)!==start||start<semester.firstMonday||start>monday(semester.endDate))throw new HttpError(422,'WEEKLY_DATE_INVALID','请选择该学期内的周一作为周起始日期')
  const result={semesterId:semester.id,semesterName:semester.name,calendarConfigured:semester.calendarConfigured,weekStart:start,weekEnd:day(start,6),weekNumber:Math.floor((Date.parse(start)-Date.parse(semester.firstMonday))/604800000)+1}
  return {...result,label:label(result)}
 }
 async function calendar(user,semesterId,input){
  requireRole(user,'admin')
  return inTransaction(database,async()=>{
   const semester=await database.prepare('SELECT * FROM semesters WHERE id=?'+(database.dialect==='mysql'?' FOR UPDATE':'')).get(semesterId)
   if(!semester)throw new HttpError(404,'WEEKLY_SEMESTER_NOT_FOUND','学期不存在')
   validateFirstMonday(input.firstMonday,semester.start_date,semester.end_date)
   const found=await database.prepare('SELECT semester_id,first_monday FROM weekly_calendars WHERE semester_id=?').get(semesterId)
   if(input.firstMonday!==(found?.first_monday||monday(semester.start_date))&&await database.prepare('SELECT id FROM weekly_records WHERE semester_id=? LIMIT 1').get(semesterId))throw new HttpError(409,'WEEKLY_CALENDAR_USED','该学期已有周台账，教学周次需保持一致')
   if(found)await database.prepare('UPDATE weekly_calendars SET first_monday=?,updated_at=? WHERE semester_id=?').run(input.firstMonday,nowIso(),semesterId)
   else await database.prepare('INSERT INTO weekly_calendars(semester_id,first_monday,updated_at) VALUES(?,?,?)').run(semesterId,input.firstMonday,nowIso())
   await audit(user.id,'设置周台账教学周','weekly_calendar',semesterId,{firstMonday:input.firstMonday})
   return options(user)
  })
 }
 function unpack(row){return {...dataProtector.unprotectJson(row.record_json,'weekly:'+row.id),id:row.id,registryStudentId:row.registry_student_id,counselorId:row.counselor_user_id,counselorName:row.counselor_name||'',revision:Number(row.revision),createdAt:row.created_at,updatedAt:row.updated_at}}
 async function raw(user,id){
  staff(user)
  const row=await database.prepare('SELECT w.*,u.display_name AS counselor_name FROM weekly_records w JOIN users u ON u.id=w.counselor_user_id WHERE w.id=?').get(id)
  if(!row||(user.role==='counselor'&&row.counselor_user_id!==user.id))throw new HttpError(404,'WEEKLY_NOT_FOUND','周台账不存在或无权访问')
  return row
 }
 async function snapshot(student){
  const profile=await database.prepare('SELECT contact FROM counselor_profiles WHERE user_id=?').get(student.counselorId)
  const result={}
  for(const field of ['college','campus','name','gender','major','phone','dorm','studentSupport','studentNo'])result[field]=student[field]||''
  result.counselorInfo=student.counselorInfo||[student.counselorName,profile?.contact].filter(Boolean).join(' / ')
  return result
 }
 async function list(user,filters={}){
  staff(user)
  const p=await period(user,filters)
  const args=[p.semesterId,p.weekStart],where=['w.semester_id=?','w.week_start=?']
  if(user.role==='counselor'){where.push('w.counselor_user_id=?');args.push(user.id)}else if(filters.counselorId){where.push('w.counselor_user_id=?');args.push(filters.counselorId)}
  const saved=await database.prepare(`SELECT w.*,u.display_name AS counselor_name FROM weekly_records w JOIN users u ON u.id=w.counselor_user_id WHERE ${where.join(' AND ')}`).all(...args)
  const rows=new Map(saved.map(row=>{const record=unpack(row);return [record.registryStudentId,record]}))
  const students=await listRegistryStudents(user,user.role==='admin'&&filters.counselorId?{counselorId:filters.counselorId}:{})
  for(const student of students){
   if(rows.has(student.id)){rows.get(student.id).studentRevision=student.revision;continue}
   const rating=weeklyLevel(student,p.weekStart,p.weekEnd)
   if(rating.eligible)rows.set(student.id,{id:null,registryStudentId:student.id,counselorId:student.counselorId,counselorName:student.counselorName,studentRevision:student.revision,revision:0,snapshot:await snapshot(student),period:p,rating,status:'pending',psychologicalStatus:'',notes:'',createdAt:null,updatedAt:null})
  }
  const q=String(filters.q||'').trim().toLowerCase()
  if(filters.status&&!['pending','draft','completed'].includes(filters.status))throw new HttpError(422,'WEEKLY_STATUS_INVALID','请选择有效的填写状态')
  const selected=[...rows.values()].filter(r=>(!filters.studentId||r.registryStudentId===filters.studentId)&&(!q||[r.snapshot.name,r.snapshot.studentNo,r.snapshot.major,r.snapshot.college].some(v=>v.toLowerCase().includes(q)))&&(!filters.college||r.snapshot.college===filters.college)&&(!filters.campus||r.snapshot.campus===filters.campus)&&(!filters.status||r.status===filters.status)).sort((a,b)=>a.snapshot.college.localeCompare(b.snapshot.college,'zh-CN')||a.snapshot.name.localeCompare(b.snapshot.name,'zh-CN')||a.registryStudentId.localeCompare(b.registryStudentId))
  return {period:p,rows:selected,counts:{total:selected.length,pending:selected.filter(r=>r.status==='pending').length,draft:selected.filter(r=>r.status==='draft').length,completed:selected.filter(r=>r.status==='completed').length}}
 }
 async function detail(user,studentId,filters){
  await getRegistryStudent(user,studentId)
  const result=await list(user,{semesterId:filters.semesterId,weekStart:filters.weekStart,studentId})
  if(!result.rows.length)throw new HttpError(404,'WEEKLY_NOT_ELIGIBLE','该学生在所选周不属于一级名单，且没有已保存台账')
  return result.rows[0]
 }
 async function save(user,studentId,input){
  requireRole(user,'counselor')
  const status=input.status
  if(!['draft','completed'].includes(status))throw new HttpError(422,'WEEKLY_STATUS_INVALID','请选择保存草稿或保存本周记录')
  const psychologicalStatus=text(input.psychologicalStatus??'',2000,'心理状况'),notes=text(input.notes??'',2000,'备注')
  const campus=text(input.campus??'',100,'校区'),major=text(input.major??'',150,'专业')
  if(status==='completed'&&(!psychologicalStatus||!campus||!major))throw new HttpError(422,'WEEKLY_INCOMPLETE','保存本周记录前请补齐校区、专业和心理状况；也可先保存草稿')
  return inTransaction(database,async()=>{
   if(database.dialect==='mysql'){
    await database.prepare('SELECT id FROM semesters WHERE id=? FOR UPDATE').get(input.semesterId||'')
    await database.prepare("SELECT id FROM users WHERE role='counselor' ORDER BY id FOR UPDATE").all()
   }
   const p=await period(user,input),student=await getRegistryStudent(user,studentId)
   const existing=await database.prepare('SELECT * FROM weekly_records WHERE registry_student_id=? AND week_start=?').get(studentId,p.weekStart)
   if(existing&&existing.counselor_user_id!==user.id)throw new HttpError(404,'WEEKLY_NOT_FOUND','周台账不存在或无权访问')
   if(existing&&existing.semester_id!==p.semesterId)throw new HttpError(409,'WEEKLY_SEMESTER_CONFLICT','该学生本周已有其他学期下的台账，请核对学期')
   const rating=weeklyLevel(student,p.weekStart,p.weekEnd)
   if(!existing&&!rating.eligible)throw new HttpError(422,'WEEKLY_NOT_ELIGIBLE','只有所选周评级为一级的学生可以新建周台账')
   const old=existing?unpack(existing):null
   const value={snapshot:{...(old?.snapshot||await snapshot(student)),campus,major},period:old?.period||p,rating:old?.rating||rating,status,psychologicalStatus,notes}
   if(!Number.isInteger(input.revision)||input.revision!==(existing?Number(existing.revision):0)){
    // Identical creation retries return the single persisted record.
    if(existing&&input.revision===0&&JSON.stringify(value)===JSON.stringify(dataProtector.unprotectJson(existing.record_json,'weekly:'+existing.id)))return detail(user,studentId,input)
    throw new HttpError(409,'WEEKLY_CHANGED','台账已被修改，请重新打开后编辑，当前内容尚未覆盖')
   }
   const now=nowIso()
   if(input.syncProfile===true&&(student.campus!==campus||student.major!==major)){
    if(input.studentRevision!==student.revision)throw new HttpError(409,'REGISTRY_CHANGED','学生档案已更新，请重新打开后补充资料')
    const row=await database.prepare('SELECT record_json FROM registry_students WHERE id=?').get(studentId)
    const data=dataProtector.unprotectJson(row.record_json,'registry:'+studentId)
    const update=await database.prepare('UPDATE registry_students SET record_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(dataProtector.protectJson({...data,campus,major},'registry:'+studentId),now,studentId,student.revision)
    if(!update.changes)throw new HttpError(409,'REGISTRY_CHANGED','学生档案已更新，请重新打开后补充资料')
    await audit(user.id,'补充学生校区和专业','registry_student',studentId,{})
   }
   const id=existing?.id||crypto.randomUUID(),revision=(existing?Number(existing.revision):0)+1
   if(existing){
    const update=await database.prepare('UPDATE weekly_records SET record_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(dataProtector.protectJson(value,'weekly:'+id),now,id,input.revision)
    if(!update.changes)throw new HttpError(409,'WEEKLY_CHANGED','台账已更新，请重新打开后编辑')
   }else await database.prepare('INSERT INTO weekly_records(id,registry_student_id,counselor_user_id,semester_id,week_start,record_json,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').run(id,studentId,user.id,p.semesterId,p.weekStart,dataProtector.protectJson(value,'weekly:'+id),now,now)
   await database.prepare('INSERT INTO weekly_record_versions(record_id,revision,record_json,actor_user_id,created_at) VALUES(?,?,?,?,?)').run(id,revision,dataProtector.protectJson(value,'weekly-version:'+id+':'+revision),user.id,now)
   await audit(user.id,'保存一级学生周台账','weekly_record',id,{revision,status,weekStart:p.weekStart})
   return detail(user,studentId,input)
  })
 }
 async function versions(user,id){
  await raw(user,id)
  const rows=await database.prepare('SELECT v.*,u.display_name AS actor_name FROM weekly_record_versions v JOIN users u ON u.id=v.actor_user_id WHERE v.record_id=? ORDER BY v.revision DESC').all(id)
  return rows.map(r=>({...dataProtector.unprotectJson(r.record_json,'weekly-version:'+id+':'+r.revision),revision:Number(r.revision),savedAt:r.created_at,actorName:r.actor_name}))
 }
 async function history(user,studentId){
  await getRegistryStudent(user,studentId)
  const args=[studentId],scope=user.role==='counselor'?' AND w.counselor_user_id=?':''
  if(user.role==='counselor')args.push(user.id)
  return (await database.prepare('SELECT w.*,u.display_name AS counselor_name FROM weekly_records w JOIN users u ON u.id=w.counselor_user_id WHERE w.registry_student_id=?'+scope+' ORDER BY w.week_start DESC').all(...args)).map(unpack)
 }
 async function report(user,filters={},format='xlsx'){
  const data=await list(user,filters)
  if(!data.rows.length)throw new HttpError(422,'WEEKLY_EXPORT_EMPTY','当前查询没有可导出的学生')
  if(data.rows.some(r=>r.status!=='completed')&&filters.includeIncomplete!==true&&filters.includeIncomplete!=='1')throw new HttpError(422,'WEEKLY_EXPORT_INCOMPLETE','本周还有未完成记录。可筛选“已填写”，或勾选“包含未完成记录”后导出')
  await audit(user.id,format==='xlsx'?'导出一级学生周台账':'打印一级学生周台账','weekly_export','',{count:data.rows.length,weekStart:data.period.weekStart})
  if(format==='print')return {...data,headers:WEEKLY_HEADERS}
  return writeWeeklyWorkbook(data.rows,data.period)
 }
 return {getWeeklyOptions:options,saveWeeklyCalendar:calendar,listWeeklyLedgers:list,getWeeklyStudent:detail,saveWeeklyRecord:save,getWeeklyVersions:versions,getWeeklyHistory:history,exportWeeklyWorkbook:(u,f)=>report(u,f,'xlsx'),printWeeklyLedgers:(u,f)=>report(u,f,'print')}
}
module.exports={createWeeklyServices,monday,day,label}
