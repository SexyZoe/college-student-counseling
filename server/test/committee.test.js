const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const JSZip=require('jszip'),ExcelJS=require('exceljs')
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom')
const {openDatabase,seedDemoData}=require('../src/database')
const {createServices}=require('../src/services')
const {createHttpApp}=require('../src/app')
const {writeCommitteeWorkbook}=require('../src/committee-workbook')
const config={authSecret:'committee-tests',dataEncryptionKey:'bc'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
test('心理委员数据库：权限、班级、任职历史、跨学期及原表导出',async t=>{
 const db=openDatabase(':memory:');await seedDemoData(db);const svc=createServices(db,config),server=http.createServer(createHttpApp(svc,config));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));db.close()})
 const base='http://127.0.0.1:'+server.address().port+'/api/v1'
 async function req(url,token,method='GET',body,binary=false){const r=await fetch(base+url,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,type:r.headers.get('content-type'),data:binary&&r.ok?Buffer.from(await r.arrayBuffer()):await r.json()}}
 const admin=db.prepare("SELECT * FROM users WHERE role='admin'").get(),user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
 const login=async(role,accountId)=>(await req('/auth/login',null,'POST',{role,accountId,password:'123456'})).data.data.token
 const at=await login('admin','admin'),ut=await login('counselor','T001'),other=await svc.createAdminCounselor(admin,{staffId:'T002'});db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').run(other.id);const ot=await login('counselor','T002')
 const cinput={semesterId:'2026-1',college:'信息学院',campus:'东校区',name:'2026级计算机1班'}
 let c,m
 await t.test('班级创建、必填项、重复归属和匿名隔离',async()=>{
  assert.equal((await req('/committee/classes')).status,401)
  assert.equal((await req('/committee/export',ut,'POST',null,true)).status,422)
  assert.equal((await req('/committee/export',ut,'POST',{semesterId:{}},true)).status,422)
  assert.equal((await req('/committee/export',ut,'POST',{q:{}},true)).status,422)
  assert.equal((await req('/committee/classes',ut,'POST',{...cinput,counselorId:other.id})).status,403)
  assert.equal((await req('/committee/classes',ut,'POST',{...cinput,campus:''})).status,422)
  let r=await req('/committee/classes',ut,'POST',cinput);assert.equal(r.status,201,JSON.stringify(r.data));c=r.data.data
  assert.equal((await req('/committee/classes',ot,'POST',cinput)).status,409)
  assert.equal((await req('/committee/classes/'+c.id,ot)).status,404)
  assert.equal((await req('/committee/classes?semesterId=2026-1',ot)).data.data.classes.length,0)
 })
 await t.test('多名委员、加密、同名核对与修改冲突',async()=>{
  const r=await req('/committee/classes/'+c.id+'/members',ut,'POST',{name:'测试委员甲',gender:'女',phone:'001234',studentNo:'00001'});assert.equal(r.status,201);m=r.data.data
  assert.match(db.prepare('SELECT record_json FROM committee_members WHERE id=?').get(m.id).record_json,/^enc:v1:/)
  assert.equal((await req('/committee/classes/'+c.id+'/members',ot,'POST',{name:'篡改'})).status,404)
  assert.equal((await req('/committee/classes/'+c.id+'/members',at,'POST',{name:'代填'})).status,403)
  assert.equal((await req('/committee/classes/'+c.id+'/members',ut,'POST',{name:'重复',studentNo:'00001'})).status,409)
  assert.equal((await req('/committee/classes/'+c.id+'/members',ut,'POST',{name:'测试委员乙',gender:'男',phone:'=1+1',studentNo:'00002'})).status,201)
  const patch={...m,phone:'009876',revision:m.revision};const saved=await req('/committee/classes/'+c.id+'/members/'+m.id,ut,'PATCH',patch);assert.equal(saved.status,200);m=saved.data.data
  assert.equal((await req('/committee/classes/'+c.id+'/members/'+m.id,ut,'PATCH',patch)).status,409)
  assert.equal((await req('/committee/classes?semesterId=2026-1&q='+encodeURIComponent('测试委员乙'),ut)).data.data.counts.members,1)
 })
 await t.test('辅导员维护本人表头；管理员只读；同学院其他辅导员表头隔离',async()=>{
  const input={college:'信息学院',schoolTeacherName:'测试校老师',schoolTeacherContact:'010-00001',collegeLeaderName:'测试院老师',collegeLeaderContact:'010-00002',revision:0}
  assert.equal((await req('/committee/college-headers',at,'PATCH',input)).status,403)
  assert.equal((await req('/committee/college-headers',ut,'PATCH',input)).status,200)
  assert.equal((await req('/committee/college-headers',ut,'PATCH',input)).status,409)
  assert.equal((await req('/committee/college-headers',ot,'PATCH',input)).status,403)
  assert.match(db.prepare('SELECT record_json FROM committee_counselor_headers').get().record_json,/^enc:v1:/)
 })
 await t.test('单学院原表6列、两面、分组合并和前导零；任意公式文本不执行',async()=>{
  const r=await req('/committee/export',ut,'POST',{semesterId:'2026-1'},true);assert.equal(r.status,200);assert.match(r.type,/spreadsheetml/)
  const w=new ExcelJS.Workbook();await w.xlsx.load(r.data);assert.deepEqual(w.worksheets.map(s=>s.name),['正面','反面']);const s=w.worksheets[0]
  assert.match(s.getCell('A1').text,/信息学院/);assert.match(s.getCell('A2').text,/测试校老师/);assert.match(s.getCell('A3').text,/测试院老师/)
  assert.equal(s.getCell('D5').text,'测试委员甲');assert.equal(s.getCell('F5').text,'009876');assert.equal(s.getCell('F6').type,ExcelJS.ValueType.String);assert.equal(s.getCell('F6').text,'=1+1')
  assert.ok(s.model.merges.includes('A5:A6'));assert.ok(s.model.merges.includes('B5:B6'));assert.ok(s.model.merges.includes('C5:C6'));assert.equal(s.pageSetup.orientation,'portrait');assert.equal(s.pageSetup.scale,38)
  assert.equal(w.worksheets[1].getCell('A7').text,'具体内容：');assert.equal(w.worksheets[1].getCell('A14').text,'具体内容：')
 })
 await t.test('管理员跨学院导出打包，辅导员导出无他人数据',async()=>{
  const second=await svc.saveCommitteeClass(db.prepare('SELECT * FROM users WHERE id=?').get(other.id),{...cinput,college:'人文学院',name:'2026级中文1班',counselorId:other.id})
  await svc.saveCommitteeMember(db.prepare('SELECT * FROM users WHERE id=?').get(other.id),second.id,{name:'他人委员',gender:'女',phone:'0011'})
  const all=await req('/committee/export',at,'POST',{semesterId:'2026-1'},true);assert.equal(all.type,'application/zip');const zip=await JSZip.loadAsync(all.data);assert.equal(Object.keys(zip.files).length,2)
  const own=await req('/committee/export',ut,'POST',{semesterId:'2026-1',counselorId:other.id},true);assert.match(own.type,/spreadsheetml/);const w=new ExcelJS.Workbook();await w.xlsx.load(own.data);assert.doesNotMatch(w.worksheets[0].getCell('A1').text,/人文/)
  assert.equal((await req('/committee/export',ot,'POST',{semesterId:'2026-1',classId:c.id},true)).status,422)
 })
 await t.test('离任保留、默认在任导出和按任职状态查询',async()=>{
  const r=await req('/committee/classes/'+c.id+'/members/'+m.id,ut,'PATCH',{...m,status:'former',revision:m.revision});assert.equal(r.status,200)
  assert.equal((await req('/committee/classes/'+c.id,ut)).data.data.members.length,2)
  assert.equal((await req('/committee/classes?semesterId=2026-1',ut)).data.data.counts.members,1)
  const r2=await req('/committee/export',ut,'POST',{semesterId:'2026-1',memberStatus:'former'},true);const w=new ExcelJS.Workbook();await w.xlsx.load(r2.data);assert.match(w.worksheets[0].getCell('D5').text,/测试委员甲（已离任）/)
 })
 await t.test('沿用新学期只复制在任名单，原学期和归属不被覆盖',async()=>{
  const future=await svc.createSemester(admin,{name:'2026-2027第二学期',startDate:'2027-02-22',endDate:'2027-07-09',firstMonday:'2027-02-22'})
  const r=await req('/committee/classes/'+c.id+'/copy',ut,'POST',{semesterId:future.id});assert.equal(r.status,201);assert.equal(r.data.data.members.length,1);assert.equal(r.data.data.semesterId,future.id)
  assert.equal((await req('/committee/classes/'+c.id,ut)).data.data.members.length,2)
  assert.equal((await req('/committee/classes/'+c.id+'/copy',ot,'POST',{semesterId:future.id})).status,404)
  assert.equal((await req('/committee/classes/'+c.id+'/copy',ut,'POST',{semesterId:future.id})).status,409)
 })
 await t.test('禁止管理员交接或停用班级；辅导员自主停用且旧版本不能覆盖',async()=>{
  const saved=await req('/committee/classes/'+c.id,ut,'PATCH',{...c,name:'2026级计算机1班（核对）',revision:c.revision});assert.equal(saved.status,200)
  assert.equal((await req('/committee/classes/'+c.id,ut,'PATCH',{...c,revision:c.revision})).status,409)
  const handover=await req('/committee/classes/'+c.id,at,'PATCH',{...saved.data.data,counselorId:other.id});assert.equal(handover.status,403)
  assert.equal((await req('/committee/classes/'+c.id,ut)).data.data.members.length,2);assert.equal((await req('/committee/classes/'+c.id,ot)).status,404)
  assert.equal((await req('/committee/classes/'+c.id,ut,'PATCH',{...saved.data.data,active:false})).status,200)
  assert.equal((await req('/committee/classes/'+c.id+'/members',ut,'POST',{name:'停用后新增'})).status,422)
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='导出心理危机四级预警网络原表'").get().n>=4)
 })
})
test('原表排版部件完整保留，大名单续行及样本数据清除',async()=>{
 const original=await JSZip.loadAsync(fs.readFileSync(path.join(__dirname,'../templates/committee-network/blank.xlsx')))
 const rows=Array.from({length:180},(_,i)=>({college:'测试学院',campus:'东区',counselorId:'test',counselorName:'测试老师',classId:'class'+Math.floor(i/2),className:'测试班'+Math.floor(i/2),name:'委员'+i,gender:i%2?'男':'女',phone:'000'+i,status:'active'}))
 const bytes=await writeCommitteeWorkbook('测试学院',rows,{}),actual=await JSZip.loadAsync(bytes),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',serializer=new XMLSerializer()
 for(const f of ['xl/styles.xml','xl/theme/theme1.xml','xl/worksheets/sheet2.xml'])assert.equal(await actual.file(f).async('string'),await original.file(f).async('string'))
 const a=new DOMParser().parseFromString(await actual.file('xl/worksheets/sheet1.xml').async('string'),'application/xml'),o=new DOMParser().parseFromString(await original.file('xl/worksheets/sheet1.xml').async('string'),'application/xml')
 for(const tag of ['cols','pageSetup','pageMargins','sheetFormatPr'])assert.equal(serializer.serializeToString(a.getElementsByTagNameNS(ns,tag)[0]),serializer.serializeToString(o.getElementsByTagNameNS(ns,tag)[0]))
 assert.equal(a.getElementsByTagNameNS(ns,'row').length,184);assert.equal(a.getElementsByTagNameNS(ns,'dimension')[0].getAttribute('ref'),'A1:F184')
 assert.equal(new DOMParser().parseFromString(await actual.file('xl/sharedStrings.xml').async('string'),'application/xml').getElementsByTagNameNS(ns,'si').length,0)
 const w=new ExcelJS.Workbook();await w.xlsx.load(bytes);assert.equal(w.worksheets[0].getCell('D184').text,'委员179');assert.equal(w.worksheets[0].pageSetup.printTitlesRow,'1:4')
 const long=await writeCommitteeWorkbook('测试学院',[{...rows[0],name:'长姓名'.repeat(16),phone:'0'.repeat(90)}],{}),longBook=new ExcelJS.Workbook();await longBook.xlsx.load(long);assert.ok(longBook.worksheets[0].getRow(5).height>30);assert.equal(longBook.worksheets[0].getCell('F5').text,'0'.repeat(90))
 await assert.rejects(writeCommitteeWorkbook('测试学院',[rows[0]],{collegeLeaderName:'负责人'.repeat(30)}),e=>e.code==='COMMITTEE_EXPORT_OVERFLOW')
})
test('心理委员关闭重开后保留班级、任职记录与加密表头',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'committee-persist-')),file=path.join(dir,'app.db');let db=openDatabase(file);t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true})});await seedDemoData(db)
 let s=createServices(db,config);const u=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get(),c=await s.saveCommitteeClass(u,{semesterId:'2026-1',college:'信息学院',campus:'东区',name:'持久化测试班'})
 const results=await Promise.allSettled([s.saveCommitteeMember(u,c.id,{name:'同时登记',phone:'001'}),s.saveCommitteeMember(u,c.id,{name:'同时登记',phone:'001'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 db.close();db=openDatabase(file);s=createServices(db,config);assert.equal((await s.getCommitteeClass(u,c.id)).members.length,1)
})
