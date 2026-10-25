const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),JSZip=require('jszip'),ExcelJS=require('exceljs'),{DOMParser,XMLSerializer}=require('@xmldom/xmldom'),{openDatabase,seedDemoData}=require('../src/database'),{createServices}=require('../src/services'),{createHttpApp}=require('../src/app')
const config={authSecret:'holiday-test',dataEncryptionKey:'da'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
test('假期离校：日历、逐日版本、图片权限和原模板日期导出',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'holiday-test-')),file=path.join(dir,'db.sqlite');let db=openDatabase(file);await seedDemoData(db);let svc=createServices(db,config);const server=http.createServer((...args)=>createHttpApp(svc,config)(...args));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true})});const base='http://127.0.0.1:'+server.address().port+'/api/v1',admin=db.prepare("SELECT * FROM users WHERE role='admin'").get(),user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get(),otherCreated=await svc.createAdminCounselor(admin,{staffId:'T002'});db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').run(otherCreated.id);const other=db.prepare('SELECT * FROM users WHERE id=?').get(otherCreated.id)
 async function req(url,token,method='GET',body,binary=false,mime='application/json'){const raw=Buffer.isBuffer(body),r=await fetch(base+url,{method,headers:{'content-type':mime,...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:raw?body:JSON.stringify(body)}:{})});return {status:r.status,data:r.ok&&binary?Buffer.from(await r.arrayBuffer()):await r.json()}}
 const login=async(role,id)=>(await req('/auth/login',null,'POST',{role,accountId:id,password:'123456'})).data.data.token,at=await login('admin','admin'),ut=await login('counselor','T001'),ot=await login('counselor','T002'),students=[]
 for(const [name,owner]of [['测试学生甲',user],['测试学生乙',user],['他人测试学生',other]])students.push(await svc.saveRegistryStudent(owner,{name,college:'测试学院',gradeMajor:'2026级计算机1班',counselorInfo:'测试老师 / 010-00000001',levels:{'2026-09':'一级'}}))
 let holiday,record,asset;const input={name:'国庆测试',startDate:'2026-09-30',endDate:'2026-10-08',levelMonth:'2026-09',shared:true},fields={leaveSchool:'是',leaveDate:'2026-09-30',destination:'回家',parentReport:'已确认到家',psychologicalStatus:'稳定',remarks:'=1+1',returned:'',returnReason:''}
 await t.test('共用假期、个人假期隔离、非法日期与范围校验',async()=>{
  assert.equal((await req('/holiday-periods')).status,401);assert.equal((await req('/holiday-periods',ut,'POST',input)).status,403)
  assert.equal((await req('/holiday-periods',at,'POST',input)).status,403)
  const r=await req('/holiday-periods',ut,'POST',{...input,shared:false});assert.equal(r.status,201);holiday=r.data.data
  db.prepare('UPDATE holiday_periods SET owner_user_id=NULL WHERE id=?').run(holiday.id)
  const own=(await req('/holiday-periods',ut,'POST',{...input,shared:false,name:'个人假期'})).data.data;assert.equal((await req('/holiday-departures?holidayId='+own.id+'&date=2026-10-01',ot)).status,404)
  assert.equal((await req('/holiday-periods/'+holiday.id,ut,'PATCH',{...input,revision:1})).status,403)
  for(const changed of [{startDate:'2026-02-30'},{endDate:'2027-02-01'}])assert.equal((await req('/holiday-periods',ut,'POST',{...input,shared:false,...changed})).status,422)
  assert.equal((await req('/holiday-departures?holidayId='+holiday.id+'&date=2026-11-01',ut)).status,422)
 })
 await t.test('上传截图校验、加密和访问隔离；上传本身不公开',async()=>{
  const bytes=fs.readFileSync(path.join(__dirname,'../../scripts/fixtures/holiday-confirmation.png')),r=await req('/holiday-departures/evidence',ut,'POST',bytes,false,'image/png');assert.equal(r.status,201);asset=r.data.data
  assert.equal((await req('/holiday-departures/evidence',ut,'POST',Buffer.from('<script>bad</script>'),false,'image/png')).status,422)
  assert.equal((await req('/holiday-departures/evidence/'+asset.id,ot)).status,404);assert.equal((await req('/holiday-departures/evidence/'+asset.id,ut,'GET',undefined,true)).data.length,bytes.length);assert.match(db.prepare('SELECT record_json FROM holiday_evidence WHERE id=?').get(asset.id).record_json,/^enc:v1:/)
 })
 await t.test('逐日保存、历史保留、版本冲突与未填不自动稳定',async()=>{
  let r=await req('/holiday-departures/'+students[0].id,ut,'PUT',{...fields,holidayId:holiday.id,date:'2026-09-30',revision:0,evidenceId:asset.id});assert.equal(r.status,200,JSON.stringify(r));record=r.data.data
  assert.match(db.prepare('SELECT record_json FROM holiday_departures WHERE id=?').get(record.id).record_json,/^enc:v1:/)
  assert.equal((await req('/holiday-departures/'+students[0].id,ot,'PUT',{...fields,holidayId:holiday.id,date:'2026-09-30',revision:0})).status,404)
  assert.equal((await req('/holiday-departures/'+students[0].id,ut,'PUT',{...fields,holidayId:holiday.id,date:'2026-09-30',revision:0})).status,409)
  const next=(await req('/holiday-departures/'+students[0].id+'?holidayId='+holiday.id+'&date=2026-10-01',ut)).data.data;assert.equal(next.record,null);assert.equal(next.carry.parentReport,'已确认到家');assert.equal(next.carry.psychologicalStatus,undefined)
  assert.equal((await req('/holiday-departures/'+students[0].id,at,'PUT',{})).status,403)
  r=await req('/holiday-departures/'+students[0].id,ut,'PUT',{...fields,parentReport:'辅导员已核对',psychologicalStatus:'不稳定',holidayId:holiday.id,date:'2026-09-30',revision:1,evidenceId:asset.id});assert.equal(r.status,200);record=r.data.data
  const history=(await req('/holiday-departures/'+students[0].id+'/versions?holidayId='+holiday.id+'&date=2026-09-30',ut)).data.data;assert.equal(history.length,2);assert.equal(history[1].parentReport,'已确认到家');assert.equal(history[0].revision,2)
  const list=(await req('/holiday-departures?holidayId='+holiday.id+'&date=2026-09-30',ut)).data.data;assert.equal(list.rows.length,2);assert.equal(list.calendar[0].recorded,1);assert.equal(list.calendar[0].unstable,1)
  assert.equal((await req('/holiday-periods/'+holiday.id,at,'PATCH',{...input,startDate:'2026-10-01',revision:1})).status,403)
 })
 await t.test('批量登记原子性；不修改各人的报备和截图',async()=>{
  const values={holidayId:holiday.id,date:'2026-10-01',psychologicalStatus:'稳定',students:[{studentId:students[0].id,revision:0},{studentId:students[2].id,revision:0}]};assert.equal((await req('/holiday-departures/batch',ut,'POST',values)).status,404)
  assert.equal((await svc.getHolidayDeparture(user,students[0].id,{holidayId:holiday.id,date:'2026-10-01'})).record,null)
  values.students[1].studentId=students[1].id;assert.equal((await req('/holiday-departures/batch',ut,'POST',values)).status,200)
  const d=await svc.getHolidayDeparture(user,students[0].id,{holidayId:holiday.id,date:'2026-10-01'});assert.equal(d.record.evidenceId,asset.id);assert.equal(d.record.parentReport,'辅导员已核对');assert.equal(d.record.remarks,'')
  assert.equal((await req('/holiday-departures/'+students[2].id,ot,'PUT',{...fields,holidayId:holiday.id,date:'2026-10-01',revision:0,evidenceId:asset.id})).status,404)
 })
 await t.test('原表22列、图片嵌入、单日留空、9日分表和截至日期快照',async()=>{
  await svc.saveHolidayDeparture(user,students[0].id,{...fields,holidayId:holiday.id,date:'2026-10-08',revision:0,destination:'之后的数据不得回填到9月30日',evidenceId:asset.id,returned:'是'})
  const payload={holidayId:holiday.id,from:'2026-09-30',to:'2026-09-30',ids:[students[0].id]},r=await req('/holiday-departures/export',ut,'POST',payload,true);assert.equal(r.status,200,JSON.stringify(r.data));const w=new ExcelJS.Workbook();await w.xlsx.load(r.data);const s=w.worksheets[0]
  assert.equal(s.columnCount,22);assert.equal(s.getCell('C2').text,'测试学生甲');assert.equal(s.getCell('G1').text.replace(/\n/g,''),'2026年9月等级');assert.match(s.getCell('M1').text,/2026年9月30日/);assert.equal(s.getCell('N1').text,'');assert.equal(s.getCell('M2').text,'不稳定');assert.equal(s.getCell('N2').text,'');assert.equal(s.getCell('J2').text,'回家');assert.equal(s.getCell('L2').text,'=1+1');assert.equal(s.getCell('L2').type,ExcelJS.ValueType.String);assert.ok(s.getCell('I2').value instanceof Date);assert.equal(s.getCell('I2').value.toISOString().slice(0,10),'2026-09-30');assert.ok(s.getRow(1).height>=58&&s.getRow(1).height<114);assert.ok(s.getRow(2).height<154.05);assert.ok(s.getColumn('K').width>=30);assert.equal(s.getColumn('N').hidden,true);assert.equal(s.getColumn('M').hidden,false);assert.equal(s.getColumn('U').hidden,false);assert.equal(s.pageSetup.paperSize,8);assert.equal(s.getImages().length,1);assert.equal(w.media.length,1)
  const z=await JSZip.loadAsync(r.data),orig=await JSZip.loadAsync(fs.readFileSync(path.join(__dirname,'../templates/holiday-departure/blank.xlsx'))),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',p=new DOMParser(),serial=new XMLSerializer(),actual=p.parseFromString(await z.file('xl/worksheets/sheet1.xml').async('string'),'application/xml'),before=p.parseFromString(await orig.file('xl/worksheets/sheet1.xml').async('string'),'application/xml');assert.equal(actual.getElementsByTagNameNS(ns,'col').length,22)
  const a=p.parseFromString(await z.file('xl/styles.xml').async('string'),'application/xml'),b=p.parseFromString(await orig.file('xl/styles.xml').async('string'),'application/xml');for(const tag of ['fills','borders'])assert.equal(serial.serializeToString(a.getElementsByTagNameNS(ns,tag)[0]),serial.serializeToString(b.getElementsByTagNameNS(ns,tag)[0]));assert.equal(actual.getElementsByTagNameNS(ns,'row')[0].getAttribute('customHeight'),'1');assert.equal(Object.keys(orig.files).some(n=>/media|drawing|sharedStrings|sheet2/.test(n)),false)
  const multi=await req('/holiday-departures/export',ut,'POST',{holidayId:holiday.id,from:'2026-09-30',to:'2026-10-08',includeEvidence:false},true),many=new ExcelJS.Workbook();await many.xlsx.load(multi.data);assert.equal(many.worksheets.length,2);assert.equal(many.worksheets[0].getCell('T1').text.replace(/\n/g,''),'2026年10月7日心理状态（稳定、不稳定）');assert.equal(many.worksheets[1].getCell('M1').text.replace(/\n/g,''),'2026年10月8日心理状态（稳定、不稳定）');assert.equal(many.media.length,0)
  assert.equal((await req('/holiday-departures/export',ut,'POST',{...payload,ids:[students[2].id]},true)).status,404);assert.equal((await req('/holiday-departures/export',ut,'POST',{...payload,from:'2026-09-29'},true)).status,422)
 })
 await t.test('跨年日期列准确，关闭重开记录和截图仍保留',async()=>{
  const winter=await svc.saveHolidayPeriod(user,{name:'跨年',startDate:'2026-12-30',endDate:'2027-01-02',levelMonth:'2026-09'}),result=await svc.exportHolidayWorkbook(user,{holidayId:winter.id,from:winter.startDate,to:winter.endDate});const w=new ExcelJS.Workbook();await w.xlsx.load(result.buffer);assert.match(w.worksheets[0].getCell('O1').text,/2027年1月1日/)
  db.close();db=openDatabase(file);svc=createServices(db,config);assert.equal((await svc.getHolidayDepartureVersions(user,students[0].id,{holidayId:holiday.id,date:'2026-09-30'})).length,2);assert.equal((await svc.getHolidayEvidence(user,asset.id)).width,640)
 })
})
