const {requireDataWriter}=require('./business-permissions')
const crypto=require('node:crypto'),{PDFDocument}=require('pdf-lib'),{HttpError}=require('./errors'),{inTransaction}=require('./database'),{validDate}=require('./registry-levels'),{writeHolidayWorkbook}=require('./holiday-workbook')
const FIELDS={leaveSchool:5,leaveDate:10,destination:200,parentReport:1000,remarks:2000,psychologicalStatus:10,returned:5,returnReason:1000,evidenceId:80}
const CARRY=['leaveSchool','leaveDate','destination','parentReport','evidenceId','returned','returnReason']
const chinaDate=v=>new Date(v).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})
function fail(code,message,status=422){throw new HttpError(status,code,message)}
function object(v){if(!v||typeof v!=='object'||Array.isArray(v))fail('HOLIDAY_INPUT','请提交有效表单');return v}
function text(v,max,label){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail('HOLIDAY_FIELD',label+'格式不正确或过长');return v.trim()}
function dates(from,to){if(!validDate(from)||!validDate(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>91)fail('HOLIDAY_DATES','日期范围必须有效，且不超过 92 天');const out=[];for(let d=Date.parse(from+'T00:00Z');d<=Date.parse(to+'T00:00Z');d+=86400000)out.push(new Date(d).toISOString().slice(0,10));return out}
function createHolidayServices(db,config,context){
 const {requireRole,nowIso,audit,dataProtector,listRegistryStudents,getRegistryStudent}=context,lock=db.dialect==='mysql'?' FOR UPDATE':''
 const staff=u=>requireRole(u,['admin','counselor'])
 const unpackPeriod=r=>({id:r.id,name:r.name,startDate:r.start_date,endDate:r.end_date,levelMonth:r.level_month,shared:!r.owner_user_id,ownerId:r.owner_user_id,revision:Number(r.revision),createdAt:r.created_at,updatedAt:r.updated_at})
 function unpack(r){return {...dataProtector.unprotectJson(r.record_json,'holiday-record:'+r.id),id:r.id,holidayId:r.holiday_id,studentId:r.registry_student_id,date:r.record_date,revision:Number(r.revision),createdAt:r.created_at,updatedAt:r.updated_at}}
 async function period(user,id,locking=false){staff(user);if(typeof id!=='string'||!id)fail('HOLIDAY_REQUIRED','请选择或建立一个假期');const r=await db.prepare('SELECT * FROM holiday_periods WHERE id=?'+(locking?lock:'')).get(id);if(!r||(user.role!=='admin'&&r.owner_user_id&&r.owner_user_id!==user.id))fail('HOLIDAY_NOT_FOUND','假期不存在或无权访问',404);return unpackPeriod(r)}
 async function periods(user){staff(user);const rows=await db.prepare('SELECT * FROM holiday_periods'+(user.role==='admin'?'':' WHERE owner_user_id IS NULL OR owner_user_id=?')+' ORDER BY start_date DESC,id').all(...(user.role==='admin'?[]:[user.id]));return {periods:rows.map(unpackPeriod),demo:config.weeklyPreview===true}}
 async function savePeriod(user,input,id){requireDataWriter(user);object(input);return inTransaction(db,async()=>{
  const old=id?await period(user,id,true):null;if(old&&(old.shared||old.ownerId!==user.id))fail('FORBIDDEN','共用假期为固定校级日期范围，个人假期由创建辅导员维护',403)
  if(old&&input.revision!==old.revision)fail('HOLIDAY_CHANGED','假期已更新，请重新打开',409)
  const name=text(input.name??'',100,'假期名称'),startDate=text(input.startDate??'',10,'开始日期'),endDate=text(input.endDate??'',10,'结束日期'),levelMonth=text(input.levelMonth??'',7,'等级参考月份');if(!name)fail('HOLIDAY_REQUIRED','请填写假期名称');dates(startDate,endDate);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(levelMonth))fail('HOLIDAY_MONTH','请选择有效的等级参考月份')
  if(input.shared!==undefined&&typeof input.shared!=='boolean')fail('HOLIDAY_FIELD','假期共享设置无效');if(input.shared===true)fail('FORBIDDEN','当前仅支持建立本人使用的假期',403)
  if(old){const used=await db.prepare('SELECT MIN(record_date) AS first,MAX(record_date) AS last FROM holiday_departures WHERE holiday_id=?').get(id);if(used.first&&(startDate>used.first||endDate<used.last||levelMonth!==old.levelMonth))fail('HOLIDAY_HISTORY','已有记录的日期必须保留，等级参考月份不能改写；可扩大日期范围')}
  const ownerId=old?old.ownerId:user.id,now=nowIso(),holidayId=id||crypto.randomUUID()
  if(old)await db.prepare('UPDATE holiday_periods SET name=?,start_date=?,end_date=?,level_month=?,revision=revision+1,updated_at=? WHERE id=?').run(name,startDate,endDate,levelMonth,now,id)
  else await db.prepare('INSERT INTO holiday_periods(id,name,start_date,end_date,level_month,owner_user_id,created_by_user_id,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)').run(holidayId,name,startDate,endDate,levelMonth,ownerId,user.id,now,now)
  await audit(user.id,'设置假期离校统计范围','holiday_period',holidayId,{startDate,endDate,shared:!ownerId});return period(user,holidayId)
 })}
 function day(p,date){if(!validDate(date)||date<p.startDate||date>p.endDate)fail('HOLIDAY_DATE','请选择假期范围内的有效日期');return date}
 async function scopedStudents(user,f={}){object(f);for(const k of ['q','college','counselorId','level'])if(f[k]!==undefined)text(f[k],k==='q'?200:100,'查询条件');return listRegistryStudents(user,{q:f.q||'',college:f.college||'',counselorId:f.counselorId||''})}
 async function recordRows(user,p,f={}){
  const args=[p.id],w=['d.holiday_id=?'];if(user.role==='counselor'){w.push('s.counselor_user_id=?');args.push(user.id)}else if(f.counselorId){w.push('s.counselor_user_id=?');args.push(f.counselorId)}
  return (await db.prepare('SELECT d.* FROM holiday_departures d JOIN registry_students s ON s.id=d.registry_student_id WHERE '+w.join(' AND ')+' ORDER BY d.record_date,d.id').all(...args)).map(unpack)
 }
 async function list(user,f={}){
  const p=await period(user,f.holidayId),date=day(p,f.date||[p.startDate,chinaDate(nowIso()),p.endDate].sort()[1]),students=(await scopedStudents(user,f)).filter(s=>!f.level||(s.levels[p.levelMonth]||'')===f.level),all=await recordRows(user,p,f),byStudent=new Map()
  for(const r of all){if(!byStudent.has(r.studentId))byStudent.set(r.studentId,[]);byStudent.get(r.studentId).push(r)}
  if(f.status&&!['pending','稳定','不稳定'].includes(f.status))fail('HOLIDAY_STATUS','请选择有效的当日状态')
  const rows=students.map(s=>{const history=byStudent.get(s.id)||[],current=history.find(r=>r.date===date)||null;return {student:s,record:current,latest:history.filter(r=>r.date<=date).at(-1)||null}}).filter(r=>!f.status||(f.status==='pending'?!r.record?.psychologicalStatus:r.record?.psychologicalStatus===f.status))
  const ids=new Set(students.map(s=>s.id)),calendar=dates(p.startDate,p.endDate).map(d=>{const list=all.filter(r=>r.date===d&&ids.has(r.studentId));return {date:d,recorded:list.filter(r=>r.psychologicalStatus).length,unstable:list.filter(r=>r.psychologicalStatus==='不稳定').length}})
  return {period:p,date,rows,calendar,studentCount:students.length}
 }
 async function detail(user,studentId,f){const p=await period(user,f.holidayId),date=day(p,f.date),student=await getRegistryStudent(user,studentId),history=(await db.prepare('SELECT * FROM holiday_departures WHERE holiday_id=? AND registry_student_id=? ORDER BY record_date').all(p.id,studentId)).map(unpack),record=history.find(r=>r.date===date)||null,prior=history.filter(r=>r.date<date).at(-1)||null,carry={};if(prior)for(const k of CARRY)carry[k]=prior[k];return {period:p,date,student,record,carry,carryDate:prior?.date||'',history:history.map(r=>({date:r.date,psychologicalStatus:r.psychologicalStatus,updatedAt:r.updatedAt}))}}
 async function accessibleAsset(user,id){staff(user);const a=await db.prepare('SELECT * FROM holiday_evidence WHERE id=?').get(id);if(!a)fail('HOLIDAY_IMAGE_NOT_FOUND','截图不存在或无权访问',404)
  if(user.role!=='admin'&&a.owner_user_id!==user.id){const references=await db.prepare('SELECT d.id FROM holiday_departures d JOIN registry_students s ON s.id=d.registry_student_id JOIN holiday_periods p ON p.id=d.holiday_id WHERE d.evidence_id=? AND s.counselor_user_id=? AND (p.owner_user_id IS NULL OR p.owner_user_id=?) UNION SELECT d.id FROM holiday_departure_versions v JOIN holiday_departures d ON d.id=v.record_id JOIN registry_students s ON s.id=d.registry_student_id JOIN holiday_periods p ON p.id=d.holiday_id WHERE v.evidence_id=? AND s.counselor_user_id=? AND (p.owner_user_id IS NULL OR p.owner_user_id=?)').all(id,user.id,user.id,id,user.id,user.id);if(!references.length)fail('HOLIDAY_IMAGE_NOT_FOUND','截图不存在或无权访问',404)}
  return {...dataProtector.unprotectJson(a.record_json,'holiday-evidence:'+id),id,mimeType:a.mime_type}
 }
 async function upload(user,buffer,mimeType){requireDataWriter(user);if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>2*1024*1024)fail('HOLIDAY_IMAGE_SIZE','截图大小不能超过 2MB');mimeType=String(mimeType||'').split(';')[0].toLowerCase();if(!['image/png','image/jpeg'].includes(mimeType))fail('HOLIDAY_IMAGE_TYPE','请上传 PNG 或 JPG 截图')
  if(mimeType==='image/png'&&(buffer.length<24||!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||buffer.readUInt32BE(16)>4096||buffer.readUInt32BE(20)>4096))fail('HOLIDAY_IMAGE_TYPE','PNG 图片无效或尺寸超过 4096 像素')
  let image;try{const pdf=await PDFDocument.create();image=mimeType==='image/png'?await pdf.embedPng(buffer):await pdf.embedJpg(buffer)}catch(e){fail('HOLIDAY_IMAGE_TYPE','无法读取截图，请上传有效的 PNG 或 JPG 图片')}
  if(image.width>4096||image.height>4096||image.width*image.height>12000000)fail('HOLIDAY_IMAGE_SIZE','截图尺寸过大，请缩小后上传')
  const id=crypto.randomUUID(),value={base64:buffer.toString('base64'),width:image.width,height:image.height};await db.prepare('INSERT INTO holiday_evidence(id,owner_user_id,mime_type,record_json,created_at) VALUES(?,?,?,?,?)').run(id,user.id,mimeType,dataProtector.protectJson(value,'holiday-evidence:'+id),nowIso());await audit(user.id,'上传假期家长报备截图','holiday_evidence',id,{});return {id,mimeType,width:image.width,height:image.height}
 }
 async function save(user,studentId,input){requireDataWriter(user);object(input);return inTransaction(db,async()=>{
  const p=await period(user,input.holidayId,true),date=day(p,input.date),student=await getRegistryStudent(user,studentId),old=await db.prepare('SELECT * FROM holiday_departures WHERE holiday_id=? AND registry_student_id=? AND record_date=?'+lock).get(p.id,studentId,date)
  if(input.revision!==(old?Number(old.revision):0))fail('HOLIDAY_CHANGED','这名学生当天的记录已更新，请重新打开后保存',409)
  const value={};for(const [k,max]of Object.entries(FIELDS))value[k]=text(input[k]??'',max,k)
  for(const k of ['leaveSchool','returned'])if(!['','是','否'].includes(value[k]))fail('HOLIDAY_STATUS','离校、返校状态请选择是或否');if(!['','稳定','不稳定'].includes(value.psychologicalStatus))fail('HOLIDAY_STATUS','当日心理状态请选择稳定或不稳定')
  if(value.leaveDate&&(!validDate(value.leaveDate)||value.leaveDate>p.endDate))fail('HOLIDAY_DATE','离校日期必须有效，且不能晚于假期结束日期')
  if(value.leaveSchool==='否'&&value.leaveDate)fail('HOLIDAY_DATE','选择不离校时请清空离校日期')
  if(value.returned==='是')value.returnReason=''
  if(value.evidenceId)await accessibleAsset(user,value.evidenceId)
  value.snapshot={name:student.name,college:student.college,gender:student.gender,gradeMajor:student.gradeMajor,counselorInfo:student.counselorInfo||student.counselorName,level:student.levels[p.levelMonth]||'',levelMonth:p.levelMonth}
  const id=old?.id||crypto.randomUUID(),revision=(old?Number(old.revision):0)+1,now=nowIso(),protectedData=dataProtector.protectJson(value,'holiday-record:'+id)
  if(old)await db.prepare('UPDATE holiday_departures SET record_json=?,evidence_id=?,revision=?,updated_at=? WHERE id=? AND revision=?').run(protectedData,value.evidenceId||null,revision,now,id,old.revision)
  else await db.prepare('INSERT INTO holiday_departures(id,holiday_id,registry_student_id,record_date,record_json,evidence_id,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').run(id,p.id,studentId,date,protectedData,value.evidenceId||null,now,now)
  await db.prepare('INSERT INTO holiday_departure_versions(record_id,revision,record_json,evidence_id,actor_user_id,created_at) VALUES(?,?,?,?,?,?)').run(id,revision,dataProtector.protectJson(value,'holiday-version:'+id+':'+revision),value.evidenceId||null,user.id,now);await audit(user.id,'保存假期学生离校记录','holiday_departure',id,{date,revision,holidayId:p.id});return unpack(await db.prepare('SELECT * FROM holiday_departures WHERE id=?').get(id))
 })}
 async function batch(user,input){requireDataWriter(user);object(input);if(!Array.isArray(input.students)||!input.students.length||input.students.length>100||new Set(input.students.map(s=>s.studentId)).size!==input.students.length)fail('HOLIDAY_SELECTION','每次请选择 1—100 名不同学生');if(!['稳定','不稳定',''].includes(input.psychologicalStatus))fail('HOLIDAY_STATUS','请选择有效的当日心理状态')
  return inTransaction(db,async()=>{const result=[];for(const target of input.students){object(target);const d=await detail(user,target.studentId,{holidayId:input.holidayId,date:input.date}),values=d.record||d.carry;result.push(await save(user,target.studentId,{...values,holidayId:input.holidayId,date:input.date,revision:target.revision,psychologicalStatus:input.psychologicalStatus,remarks:d.record?.remarks||''}))}return {saved:result.length}})
 }
 async function versions(user,studentId,f){const d=await detail(user,studentId,f);if(!d.record)return [];return (await db.prepare('SELECT v.*,u.display_name AS actor_name FROM holiday_departure_versions v JOIN users u ON u.id=v.actor_user_id WHERE v.record_id=? ORDER BY v.revision DESC').all(d.record.id)).map(v=>({...dataProtector.unprotectJson(v.record_json,'holiday-version:'+v.record_id+':'+v.revision),revision:Number(v.revision),actorName:v.actor_name,createdAt:v.created_at}))}
 async function report(user,input){staff(user);object(input);const p=await period(user,input.holidayId),from=input.from||p.startDate,to=input.to||p.endDate,selectedDates=dates(from,to);day(p,from);day(p,to);const students=await scopedStudents(user,input),all=await recordRows(user,p,input),ids=input.ids
  if(ids!==undefined&&(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length))fail('HOLIDAY_SELECTION','请勾选有效学生，每次最多 500 人')
  if(ids&&ids.some(id=>!students.some(s=>s.id===id)))fail('HOLIDAY_SELECTION','所选学生不存在或超出当前有权访问的范围',404)
  if(!['all','recorded'].includes(input.scope||'all'))fail('HOLIDAY_SELECTION','导出范围无效')
  const roster=students.filter(s=>(!ids||ids.includes(s.id))&&(!input.level||s.levels[p.levelMonth]===input.level)&&((input.scope||'all')!=='recorded'||all.some(r=>r.studentId===s.id&&r.date>=from&&r.date<=to)))
  if(!roster.length)fail('HOLIDAY_EXPORT_EMPTY','所选日期及学生范围内没有可导出的名单');if(roster.length>500)fail('HOLIDAY_SELECTION','请缩小导出范围，每次最多 500 人')
  roster.sort((a,b)=>a.college.localeCompare(b.college,'zh-CN')||a.counselorName.localeCompare(b.counselorName,'zh-CN')||a.name.localeCompare(b.name,'zh-CN'))
  if(input.includeEvidence!==undefined&&typeof input.includeEvidence!=='boolean')fail('HOLIDAY_FIELD','截图导出选项无效')
  const images=new Map();for(const r of (input.includeEvidence===false?[]:all).filter(r=>r.date<=to&&r.evidenceId&&roster.some(s=>s.id===r.studentId)))if(!images.has(r.evidenceId))images.set(r.evidenceId,await accessibleAsset(user,r.evidenceId))
  if(!['readable','original'].includes(input.layout||'readable')||!['a3','a4'].includes(input.paperSize||'a3'))fail('HOLIDAY_LAYOUT','请选择有效的导出版式与纸张')
  const buffer=await writeHolidayWorkbook({period:p,dates:selectedDates,students:roster,records:all,images,layout:input.layout||'readable',paperSize:input.paperSize||'a3'});await audit(user.id,'按日期导出假期离校原表','holiday_export',p.id,{from,to,students:roster.length});return {buffer,fileName:'心理库学生离校统计表-'+from+'至'+to+'.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
 }
 return {listHolidayPeriods:periods,saveHolidayPeriod:savePeriod,listHolidayDepartures:list,getHolidayDeparture:detail,saveHolidayDeparture:save,batchHolidayDepartures:batch,getHolidayDepartureVersions:versions,uploadHolidayEvidence:upload,getHolidayEvidence:accessibleAsset,exportHolidayWorkbook:report}
}
module.exports={createHolidayServices,dates}
