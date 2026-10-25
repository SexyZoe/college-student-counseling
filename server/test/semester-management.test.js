const test=require('node:test')
const assert=require('node:assert/strict')
const http=require('node:http')
const {openDatabase,seedDemoData}=require('../src/database')
const {createServices}=require('../src/services')
const {createHttpApp}=require('../src/app')
test('学期管理：跨学期选项、日历设置、切换与历史保护',async t=>{
 const db=openDatabase(':memory:');await seedDemoData(db)
 const config={authSecret:'semester-tests',tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
 const services=createServices(db,config),server=http.createServer(createHttpApp(services,config));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));db.close()})
 const base='http://127.0.0.1:'+server.address().port+'/api/v1'
 async function req(url,token,method='GET',body){const r=await fetch(base+url,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
 const adminToken=(await req('/auth/login',null,'POST',{role:'admin',accountId:'admin',password:'123456'})).data.data.token
 const token=(await req('/auth/login',null,'POST',{role:'counselor',accountId:'T001',password:'123456'})).data.data.token
 const user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
 const future={id:'2026-2',name:'2026-2027学年第二学期',startDate:'2027-02-22',endDate:'2027-07-09',firstMonday:'2027-03-01'}
 await t.test('创建学期权限与日期校验，失败时不留半份学期',async()=>{
  assert.equal((await req('/admin/semesters',token,'POST',future)).status,403)
  for(const value of [null,[],{...future,name:''},{...future,startDate:'2027-02-30'},{...future,endDate:'2027-01-01'},{...future,firstMonday:'2027-03-02'},{...future,firstMonday:'2027-08-02'}])assert.equal((await req('/admin/semesters',adminToken,'POST',value)).status,422)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM semesters').get().n,2)
 })
 await t.test('创建后所有辅导员可见，新学期周次独立从1开始',async()=>{
  const r=await req('/admin/semesters',adminToken,'POST',future);assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.data.status,'未开始')
  const options=(await req('/weekly-ledgers/options',token)).data.data
  assert.equal(options.semesters.find(s=>s.id==='2026-1').calendarConfigured,false)
  const s=options.semesters.find(s=>s.id==='2026-2');assert.equal(s.calendarConfigured,true);assert.equal(s.firstMonday,'2027-03-01')
  const p=(await req('/weekly-ledgers?'+new URLSearchParams({semesterId:s.id,weekStart:s.firstMonday}),token)).data.data.period;assert.equal(p.weekNumber,1);assert.equal(p.calendarConfigured,true)
  assert.equal((await req('/admin/semesters',adminToken,'POST',future)).status,409)
 })
 await t.test('尚无周记录可修改日历，军训后起算不受14天限制',async()=>{
  const changed={...future,firstMonday:'2027-03-15'}
  assert.equal((await req('/admin/semesters/2026-2',token,'PATCH',changed)).status,403)
  assert.equal((await req('/admin/semesters/2026-2',adminToken,'PATCH',changed)).status,200)
  assert.equal((await req('/weekly-ledgers/options',token)).data.data.semesters.find(s=>s.id==='2026-2').firstMonday,'2027-03-15')
 })
 const student=await services.saveRegistryStudent(user,{name:'跨学期测试',college:'信息学院',gradeMajor:'2026级计科',levels:{'2026-09':'一级'}})
 const old=await services.saveWeeklyRecord(user,student.id,{semesterId:'2026-1',weekStart:'2026-10-19',campus:'东区',major:'计科',status:'completed',revision:0,psychologicalStatus:'原学期保存内容'})
 await t.test('切换当前学期保留原周记录，且始终只有一个当前学期',async()=>{
  assert.equal((await req('/admin/semesters/2026-2/current',token,'PATCH',{})).status,403)
  assert.equal((await req('/admin/semesters/2026-2/current',adminToken,'PATCH',{})).status,200)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM semesters WHERE status='当前学期'").get().n,1)
  assert.equal(db.prepare('SELECT semester_id FROM weekly_records WHERE id=?').get(old.id).semester_id,'2026-1')
  assert.equal((await services.getWeeklyHistory(user,student.id))[0].psychologicalStatus,'原学期保存内容')
  const fresh=await services.saveWeeklyRecord(user,student.id,{semesterId:'2026-2',weekStart:'2027-03-15',campus:'东区',major:'计科',status:'draft',revision:0,psychologicalStatus:''})
  assert.equal(fresh.period.weekNumber,1);assert.equal(fresh.psychologicalStatus,'')
 })
 await t.test('已有记录锁定校历，拒绝前台之外的篡改请求',async()=>{
  assert.equal((await req('/admin/semesters/2026-2',adminToken,'PATCH',{...future,firstMonday:'2027-03-22'})).status,409)
  assert.equal((await req('/admin/semesters/2026-2',adminToken,'PATCH',{...future,name:'试改名',firstMonday:'2027-03-15'})).status,409)
  assert.equal((await req('/admin/semesters/2026-2',adminToken,'PATCH',{...future,firstMonday:'2027-03-15'})).status,200)
  assert.equal((await req('/weekly-ledgers/calendars/2026-2',adminToken,'PATCH',{firstMonday:'2027-03-15'})).status,200)
  assert.equal((await req('/weekly-ledgers/calendars/2026-2',adminToken,'PATCH',{firstMonday:'2027-03-22'})).status,409)
  const q=new URLSearchParams({semesterId:'2026-1',weekStart:'2026-10-19'})
  assert.match((await req('/weekly-ledgers?'+q,token)).data.data.period.label,/默认推算/)
  assert.equal((await req('/weekly-ledgers/calendars/2026-1',adminToken,'PATCH',{firstMonday:'2026-08-31'})).status,200)
  assert.doesNotMatch((await req('/weekly-ledgers?'+q,token)).data.data.period.label,/默认推算/)
 })
})
