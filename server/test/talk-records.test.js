const test=require('node:test')
const assert=require('node:assert/strict')
const crypto=require('node:crypto')
const fs=require('node:fs')
const http=require('node:http')
const JSZip=require('jszip')
const {DOMParser}=require('@xmldom/xmldom')
const {openDatabase,seedDemoData}=require('../src/database')
const {createServices}=require('../src/services')
const {createHttpApp}=require('../src/app')
const {fillTalkTemplate,checkPrintable,wrapContent,createTalkDocumentRenderer,pdfGeometry,matchingGeometry}=require('../src/talk-document')
const config={authSecret:'talk-api-tests-only',dataEncryptionKey:'ef'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
const input=(extra={})=>({name:'测试同学',gender:'女',college:'信息学院',gradeClass:'2026级计算机1班',studentNo:'TEST00001',talkDate:'2026-10-24',issues:[4,5],otherIssue:'',content:'虚构谈话测试记录。了解近期学习情况，约定后续联系。',clientRequestId:crypto.randomUUID(),...extra})

test('谈话记录：多次保存、修改、权限、加密、时间和打印原表',async t=>{
 const db=openDatabase(':memory:');await seedDemoData(db)
 let clock=Date.parse('2026-10-24T03:00:00Z')
 const service=createServices(db,config,{now:()=>clock}),server=http.createServer(createHttpApp(service,config));await new Promise(r=>server.listen(0,'127.0.0.1',r))
 t.after(async()=>{await new Promise(r=>server.close(r));db.close()})
 const base='http://127.0.0.1:'+server.address().port
 async function req(route,token,method='GET',body,binary=false){const r=await fetch(base+'/api/v1'+route,{method,headers:{'Content-Type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,body:binary&&r.ok?Buffer.from(await r.arrayBuffer()):await r.json()}}
 async function login(role,id,password='123456'){return (await req('/auth/login',null,'POST',{role,accountId:id,password})).body.data.token}
 const admin=await login('admin','admin'),one=await login('counselor','T001')
 const second=await service.createAdminCounselor(db.prepare("SELECT * FROM users WHERE role='admin'").get(),{staffId:'T099'})
 db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').run(second.id)
 const two=await login('counselor','T099')
 let saved,registryId
 await t.test('匿名不能访问，管理员只能查看、不能代写或修改',async()=>{
  assert.equal((await req('/talk-records')).status,401)
  assert.equal((await req('/talk-records',admin,'POST',input())).status,403)
  const meta=await req('/talk-records/options',one);assert.equal(meta.body.data.issues.length,9);assert.equal(meta.body.data.signatureMode,'handwritten')
 })
 await t.test('可保存未完成内容，记录系统时间且正文加密存储',async()=>{
  const draft=await req('/talk-records',one,'POST',input({gender:'',college:'',gradeClass:'',content:'',talkDate:'',issues:[]}));assert.equal(draft.status,201);assert.equal(draft.body.data.printCheck.ready,false);assert.equal(draft.body.data.createdAt,'2026-10-24T03:00:00.000Z')
  const row=db.prepare('SELECT record_json FROM talk_records WHERE id=?').get(draft.body.data.id);assert.match(row.record_json,/^enc:v1:/);assert.ok(!row.record_json.includes('测试同学'))
  assert.equal((await req('/talk-records/'+draft.body.data.id+'/document?format=pdf',one)).status,422)
 })
 await t.test('可关联本人学生档案，拒绝关联他人的学生',async()=>{
  const row=await service.saveRegistryStudent(db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get(),{name:'关联学生',college:'信息学院',gradeMajor:'2026级计算机',levels:{}});registryId=row.id
  assert.equal((await req('/talk-records',two,'POST',input({registryStudentId:registryId}))).status,404)
  const r=await req('/talk-records',one,'POST',input({registryStudentId:registryId}));assert.equal(r.status,201);saved=r.body.data;assert.equal(saved.registryStudentId,registryId)
 })
 await t.test('同一个学生每次谈话独立保存，重试新建不会重复写入',async()=>{
  const body=input({registryStudentId:registryId,talkDate:'2026-10-23'}),a=await req('/talk-records',one,'POST',body),b=await req('/talk-records',one,'POST',body)
  assert.equal(a.status,201);assert.equal(a.body.data.id,b.body.data.id);assert.notEqual(a.body.data.id,saved.id)
  assert.equal((await req('/talk-records',one,'POST',{...body,content:'不同内容'})).status,409)
 })
 await t.test('别的辅导员无法读取、修改、打印或伪造查询范围',async()=>{
  for(const route of ['/talk-records/'+saved.id,'/talk-records/'+saved.id+'/document?format=pdf'])assert.equal((await req(route,two)).status,404)
  assert.equal((await req('/talk-records/'+saved.id,two,'PATCH',input({revision:1}))).status,404)
  assert.equal((await req('/talk-records?counselorId=counselor-t001',two)).body.data.length,0)
  assert.equal((await req('/talk-records/'+saved.id,admin,'PATCH',input({revision:1}))).status,403)
 })
 await t.test('修改保留首次保存时间，更新时间和版本递增，拒绝旧版本覆盖',async()=>{
  clock+=60000
  const r=await req('/talk-records/'+saved.id,one,'PATCH',{...saved,content:'虚构记录更新：了解学习安排，约定后续联系。'});assert.equal(r.status,200);assert.equal(r.body.data.createdAt,saved.createdAt);assert.equal(r.body.data.updatedAt,'2026-10-24T03:01:00.000Z');assert.equal(r.body.data.revision,2)
  assert.equal((await req('/talk-records/'+saved.id,one,'PATCH',saved)).status,409)
  saved=r.body.data
 })
 await t.test('管理员按辅导员、学生、日期查询，列表不返回正文',async()=>{
  const r=await req('/talk-records?counselorId=counselor-t001&from=2026-10-24&to=2026-10-24',admin);assert.equal(r.body.data.length,1);assert.equal(r.body.data[0].id,saved.id);assert.equal(r.body.data[0].content,undefined)
  assert.equal((await req('/talk-records?q=TEST00001',admin)).body.data.length,3)
  assert.equal((await req('/talk-records?from=2026-10-25&to=2026-10-23',admin)).status,422)
 })
 await t.test('拒绝非法日期和选项，长记录可保存但不能截断打印',async()=>{
  assert.equal((await req('/talk-records',one,'POST',input({talkDate:'2026-02-30'}))).status,422)
  assert.equal((await req('/talk-records',one,'POST',input({issues:[10]}))).status,422)
  assert.equal((await req('/talk-records',one,'POST',input({otherIssue:'未选择其他'}))).status,422)
  const r=await req('/talk-records',one,'POST',input({content:'长谈话内容'.repeat(100)}));assert.equal(r.status,201);assert.equal(r.body.data.content.length,500);assert.equal(r.body.data.printCheck.ready,false)
  assert.equal((await req('/talk-records/'+r.body.data.id+'/document?format=pdf',one)).status,422)
 })
 await t.test('原表PDF和Word均能导出；管理员也可查看和导出',async()=>{
  const pdf=await req('/talk-records/'+saved.id+'/document?format=pdf&purpose=print&preview=1&revision=2',one,'GET',null,true);assert.equal(pdf.status,200,JSON.stringify(pdf.body));assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.match(pdf.headers.get('content-disposition'),/^inline/);assert.equal((await pdfGeometry(pdf.body)).pages,1)
  const doc=await req('/talk-records/'+saved.id+'/document?format=doc',admin,'GET',null,true);assert.equal(doc.status,200,JSON.stringify(doc.body));assert.equal(doc.body.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1')
  assert.equal((await req('/talk-records/'+saved.id+'/document?format=pdf&revision=1',one)).status,409)
  assert.equal((await req('/talk-records/'+saved.id+'/document?format=html',one)).status,422)
 })
 await t.test('测试姓名四个汉字加两位数字可以按原字号换行，PDF与Word均不撑大原表',async()=>{
  const r=await req('/talk-records',one,'POST',input({name:'测试学生01',college:'信息工程学院',content:'验证较长测试姓名在原表内换行。'}));assert.equal(r.status,201)
  for(const format of ['pdf','doc']){
   const output=await req('/talk-records/'+r.body.data.id+'/document?format='+format,one,'GET',null,true)
   assert.equal(output.status,200,JSON.stringify(output.body))
   if(format==='pdf'){const g=await pdfGeometry(output.body);assert.equal(g.pages,1);assert.equal(g.lines.length,13)}
   else assert.equal(output.body.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1')
  }
  const xml=await (await JSZip.loadAsync(await fillTalkTemplate(input({name:'测试学生01'})))).file('word/document.xml').async('string')
  const doc=new DOMParser().parseFromString(xml,'application/xml'),ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const cells=doc.getElementsByTagNameNS(ns,'tr')[0].getElementsByTagNameNS(ns,'tc'),nameCell=cells[1],spacing=nameCell.getElementsByTagNameNS(ns,'spacing')[0]
  assert.equal(spacing.getAttributeNS(ns,'lineRule'),'exact');assert.equal(spacing.getAttributeNS(ns,'line'),'240')
  assert.ok(Array.from(nameCell.getElementsByTagNameNS(ns,'sz')).every(n=>n.getAttributeNS(ns,'val')==='21'))
  assert.ok(nameCell.textContent.includes('测试学生01'))
 })
 await t.test('基本信息撑大原表时拒绝导出，已保存的内容继续保留',async()=>{
  const r=await req('/talk-records',one,'POST',input({college:'很长的学院名称'.repeat(8)}));assert.equal(r.status,201)
  const result=await req('/talk-records/'+r.body.data.id+'/document?format=pdf',one);assert.equal(result.status,422);assert.equal(result.body.error.code,'TALK_PRINT_OVERFLOW');assert.match(result.body.error.message,/学院栏/)
  assert.equal((await req('/talk-records/'+r.body.data.id,one)).body.data.college,'很长的学院名称'.repeat(8))
 })
 await t.test('审计不记录正文；停用辅导员后记录保留供管理员查看',async()=>{
  const logs=db.prepare("SELECT details_json FROM audit_logs WHERE target_type='talk_record'").all();assert.ok(logs.length>=6);assert.ok(logs.every(r=>!r.details_json.includes('虚构记录')&&!r.details_json.includes('测试同学')))
  const adminUser=db.prepare("SELECT * FROM users WHERE role='admin'").get();await service.setCounselorStatus(adminUser,'T001',{active:false})
  assert.equal((await req('/talk-records',one)).status,401)
  assert.equal((await req('/talk-records/'+saved.id,admin)).status,200)
 })
})

test('模板填充仅修改指定XML部分，保留字体、表格结构和签名区',async()=>{
 const original=await JSZip.loadAsync(fs.readFileSync(require('node:path').join(__dirname,'../templates/talk-form/template.docx')))
 const filled=await JSZip.loadAsync(await fillTalkTemplate(input({name:'林<&同学',issues:[4,9],otherIssue:'其他测试'})))
 for(const name of Object.keys(original.files))if(name!=='word/document.xml')assert.deepEqual(await filled.file(name).async('nodebuffer'),await original.file(name).async('nodebuffer'),name)
 const xml=await filled.file('word/document.xml').async('string'),doc=new DOMParser().parseFromString(xml,'application/xml')
 assert.ok(doc.documentElement.textContent.includes('林<&同学'));assert.match(xml,/辅导员签名：\s+学生签名：\s+日期：2026-10-24/);assert.match(xml,/具体谈话内容：/)
 assert.equal(wrapContent('测'.repeat(36)).length,1);assert.equal(checkPrintable(input({content:'测'.repeat(181)})).ready,false)
})

test('心理困扰导出只保留选中项，原编号、多选和其他内容完整保留',async()=>{
 const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
 for(const [extra,expected] of [
  [{issues:[1]},'近期心理困扰：1. 适应困难'],
  [{issues:[1,4]},'近期心理困扰：1. 适应困难；4. 学业压力'],
  [{issues:[9],otherIssue:'其他测试<&内容'},'近期心理困扰：9. 其他：其他测试<&内容'],
  [{issues:[1,4,9],otherIssue:'其他测试'},'近期心理困扰：1. 适应困难；4. 学业压力；9. 其他：其他测试']
 ]){
  const filled=await JSZip.loadAsync(await fillTalkTemplate(input(extra)))
  const doc=new DOMParser().parseFromString(await filled.file('word/document.xml').async('string'),'application/xml')
  const issueRow=doc.getElementsByTagNameNS(ns,'tr')[2]
  assert.equal(issueRow.textContent,expected)
  assert.equal(issueRow.getElementsByTagNameNS(ns,'u').length,0)
 }
})

test('转换器不可用时明确报错，不能伪装导出成功',async()=>{
 const renderer=createTalkDocumentRenderer({documentConverterPath:'/nonexistent/talk-test-converter'})
 await assert.rejects(renderer.render(input(),'pdf'),e=>e.code==='TALK_CONVERTER_UNAVAILABLE'&&e.status===503)
})


test('谈话记录持久保存且并发重试不重复创建',async()=>{
 const os=require('node:os'),path=require('node:path')
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'talk-persist-test-')),file=path.join(dir,'talk.db')
 let db
 try{
  db=openDatabase(file);await seedDemoData(db)
  let service=createServices(db,config),user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
  const data=input(),results=await Promise.all([service.saveTalkRecord(user,data),service.saveTalkRecord(user,data)])
  assert.equal(results[0].id,results[1].id);const id=results[0].id
  db.close();db=openDatabase(file);service=createServices(db,config);user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
  const restored=await service.getTalkRecord(user,id)
  assert.equal(restored.content,data.content);assert.equal(restored.talkDate,data.talkDate);assert.equal(restored.createdAt,results[0].createdAt)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talk_records').get().n,1)
  assert.match(db.prepare('SELECT record_json FROM talk_records').get().record_json,/^enc:v1:/)
 }finally{if(db)db.close();fs.rmSync(dir,{recursive:true,force:true})}
})
