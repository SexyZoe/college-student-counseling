const test=require('node:test')
const assert=require('node:assert/strict')
const http=require('node:http')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const ExcelJS=require('exceljs')
const {openDatabase,seedDemoData}=require('../src/database')
const {createServices}=require('../src/services')
const {createHttpApp}=require('../src/app')
const {weeklyLevel,isLevelOne,validDate}=require('../src/registry-levels')
const config={authSecret:'weekly-test',dataEncryptionKey:'ab'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}

test('一级识别、跨月沿用和周内等级变化',()=>{
 for(const value of ['一级','1级','一','1','Ⅰ','I','１级'])assert.equal(isLevelOne(value),true)
 assert.equal(isLevelOne('二级'),false);assert.equal(validDate('2026-02-30'),false)
 assert.equal(weeklyLevel({levels:{'2026-09':'一级'}},'2026-10-05','2026-10-11').eligible,true)
 const record={levels:{'2026-10':'二级'},levelHistory:[{month:'2026-10',level:'一级',effectiveDate:'2026-10-01',recordedAt:'a'},{month:'2026-10',level:'二级',effectiveDate:'2026-10-22',recordedAt:'b'}]}
 assert.equal(weeklyLevel(record,'2026-10-19','2026-10-25').eligible,true)
 assert.equal(weeklyLevel(record,'2026-10-26','2026-11-01').eligible,false)
})

test('周台账 API：名单、隔离、版本、历史快照、原表导出及日历',async t=>{
 const db=openDatabase(':memory:');await seedDemoData(db);const svc=createServices(db,config)
 const server=http.createServer(createHttpApp(svc,config));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));db.close()})
 const base='http://127.0.0.1:'+server.address().port+'/api/v1'
 async function req(path,token,method='GET',body,binary=false){const r=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:binary&&r.ok?Buffer.from(await r.arrayBuffer()):await r.json()}}
 const admin=db.prepare("SELECT * FROM users WHERE role='admin'").get(),user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
 const login=async(role,accountId)=>(await req('/auth/login',null,'POST',{role,accountId,password:'123456'})).data.data.token
 const at=await login('admin','admin'),ut=await login('counselor','T001')
 const other=await svc.createAdminCounselor(admin,{staffId:'T002'});db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').run(other.id);const ot=await login('counselor','T002')
 const input={college:'信息学院',name:'测试甲',gradeMajor:'2026级计科',campus:'东校区',major:'计算机科学与技术',phone:'0013800',levels:{'2026-10':'一级'},levelEffectiveDates:{'2026-10':'2026-10-21'}}
 let student=await svc.saveRegistryStudent(user,input)
 await svc.saveRegistryStudent(user,{...input,name:'二级学生',levels:{'2026-10':'二级'}})
 const p={semesterId:'2026-1',weekStart:'2026-10-19'},q=new URLSearchParams(p)
 const url='/weekly-ledgers/students/'+student.id
 let record
 await t.test('匿名拒绝、按生效周列入、其他辅导员隔离',async()=>{
  assert.equal((await req('/weekly-ledgers?'+q)).status,401)
  assert.equal((await req('/weekly-ledgers?'+q,ut)).data.data.rows.length,1)
  assert.equal((await req('/weekly-ledgers?'+new URLSearchParams({...p,weekStart:'2026-10-12'}),ut)).data.data.rows.length,0)
  assert.equal((await req('/weekly-ledgers?'+q,ot)).data.data.rows.length,0)
  assert.equal((await req(url+'?'+q,ot)).status,404)
  assert.equal((await req('/weekly-ledgers?'+new URLSearchParams({...p,weekStart:'2026-10-20'}),ut)).status,422)
 })
 await t.test('教学周仅管理员可设置，周次随日历计算',async()=>{
  assert.equal((await req('/weekly-ledgers/calendars/2026-1',ut,'PATCH',{firstMonday:'2026-09-07'})).status,403)
  assert.equal((await req('/weekly-ledgers/calendars/2026-1',at,'PATCH',{firstMonday:'2026-09-07'})).status,200)
  assert.equal((await req('/weekly-ledgers?'+q,at)).data.data.period.weekNumber,7)
 })
 await t.test('草稿、必填校验、重复创建和冲突保护',async()=>{
  assert.equal((await req(url,at,'POST',{...p,status:'draft'})).status,403)
  assert.equal((await req(url,ut,'POST',{...p,status:'completed',revision:0})).status,422)
  const value={...p,status:'draft',revision:0,campus:'东校区',major:'计算机科学与技术',psychologicalStatus:'本周测试记录'}
  let response=await req(url,ut,'POST',value);assert.equal(response.status,200,JSON.stringify(response.data));record=response.data.data
  const retry=await req(url,ut,'POST',value);assert.equal(retry.status,200);assert.equal(retry.data.data.id,record.id)
  assert.equal((await req(url,ut,'POST',{...value,psychologicalStatus:'旧页面覆盖'})).status,409)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM weekly_records').get().n,1)
  assert.match(db.prepare('SELECT record_json FROM weekly_records').get().record_json,/^enc:v1:/)
 })
 await t.test('已完成修改留存版本，校区专业可同步档案',async()=>{
  const response=await req(url,ut,'POST',{...p,status:'completed',revision:record.revision,studentRevision:student.revision,syncProfile:true,campus:'南校区',major:'软件工程',psychologicalStatus:'已完成的本周测试记录',notes:'每周继续联系'})
  assert.equal(response.status,200);record=response.data.data;assert.equal(record.revision,2)
  student=await svc.getRegistryStudent(user,student.id);assert.equal(student.campus,'南校区')
  const versions=(await req('/weekly-ledgers/records/'+record.id+'/versions',at)).data.data
  assert.deepEqual(versions.map(v=>v.revision),[2,1]);assert.equal(versions[1].status,'draft')
  assert.equal((await req('/weekly-ledgers/records/'+record.id+'/versions',ot)).status,404)
  assert.equal((await req('/weekly-ledgers/calendars/2026-1',at,'PATCH',{firstMonday:'2026-08-31'})).status,409)
 })
 await t.test('降级后停止后续名单，已保存快照和往周记录保留',async()=>{
  student=await svc.saveRegistryStudent(user,{...student,name:'已改名',phone:'新电话',levels:{'2026-10':'二级'},levelEffectiveDates:{'2026-10':'2026-10-23'}} ,student.id)
  const existing=(await req(url+'?'+q,ut)).data.data
  assert.equal(existing.snapshot.name,'测试甲');assert.equal(existing.snapshot.phone,'0013800')
  assert.equal((await req('/weekly-ledgers?'+new URLSearchParams({...p,weekStart:'2026-10-26'}),ut)).data.data.rows.length,0)
  assert.equal((await req(url+'/history',at)).data.data.length,1)
  assert.equal((await req(url+'/history',ot)).status,404)
 })
 await t.test('按辅导员、校区、状态查询，导出学校12列并保留前导零',async()=>{
  assert.equal((await req('/weekly-ledgers?'+q+'&campus='+encodeURIComponent('南校区'),at)).data.data.rows.length,1)
  assert.equal((await req('/weekly-ledgers?'+q+'&counselorId='+other.id,at)).data.data.rows.length,0)
  const r=await req('/weekly-ledgers/export',ut,'POST',p,true);assert.equal(r.status,200)
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(r.data);const s=wb.worksheets[0]
  assert.match(s.getCell('A1').text,/严重心理问题学生周台账表/);assert.match(s.getCell('A2').text,/第7周/)
  assert.equal(s.getCell('D4').text,'测试甲');assert.equal(s.getCell('G4').value,'0013800');assert.equal(s.getCell('K4').value,'已完成的本周测试记录');assert.equal(s.columnCount,12)
  assert.equal(s.pageSetup.orientation,'landscape');assert.equal(s.pageSetup.printTitlesRow,'1:3')
  const print=(await req('/weekly-ledgers/print',at,'POST',p)).data.data;assert.equal(print.headers.length,12)
  const next={...p,weekStart:'2026-10-12'};await svc.saveRegistryStudent(user,{...input,name:'未填测试',levels:{'2026-10':'一级'},levelEffectiveDates:{'2026-10':'2026-10-01'}})
  assert.equal((await req('/weekly-ledgers/export',ut,'POST',next)).status,422)
  const incomplete=await req('/weekly-ledgers/export',ut,'POST',{...next,includeIncomplete:true},true);assert.equal(incomplete.status,200)
  const pendingBook=new ExcelJS.Workbook();await pendingBook.xlsx.load(incomplete.data);assert.match(pendingBook.worksheets[0].getCell('K4').text,/未填写/)
 })
})

test('周台账并发写入和重启持久保存',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weekly-persist-')),file=path.join(dir,'app.db');let db=openDatabase(file)
 t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true})})
 await seedDemoData(db);let svc=createServices(db,config)
 const user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
 const s=await svc.saveRegistryStudent(user,{name:'持久化测试',college:'信息学院',gradeMajor:'2026级',levels:{'2026-10':'一级'}})
 const value={semesterId:'2026-1',weekStart:'2026-10-19',revision:0,campus:'东区',major:'计科',psychologicalStatus:'本周测试',status:'completed'}
 const results=await Promise.allSettled([svc.saveWeeklyRecord(user,s.id,value),svc.saveWeeklyRecord(user,s.id,{...value,psychologicalStatus:'同时提交的另一个版本'})])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'WEEKLY_CHANGED')
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM weekly_record_versions').get().n,1)
 const saved=results.find(r=>r.status==='fulfilled').value
 db.close();db=openDatabase(file);svc=createServices(db,config)
 const reopened=await svc.getWeeklyStudent(user,s.id,value)
 assert.equal(reopened.psychologicalStatus,saved.psychologicalStatus);assert.equal(reopened.revision,1)
 assert.equal((await svc.getWeeklyVersions(user,saved.id)).length,1)
})
