const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),ExcelJS=require('exceljs'),JSZip=require('jszip'),{DOMParser,XMLSerializer}=require('@xmldom/xmldom'),{PDFDocument}=require('pdf-lib')
const {openDatabase,seedDemoData}=require('../src/database'),{createServices}=require('../src/services'),{createHttpApp}=require('../src/app'),{fillGradeWorkbook,checkGradePrintable}=require('../src/grade-document')
const config={authSecret:'application-tests',dataEncryptionKey:'ef'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
test('降级出库申请：权限、保存版本、管理员只读、严格原表导出与持久化',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grade-app-test-')),file=path.join(dir,'test.db');let db=openDatabase(file);await seedDemoData(db);let svc=createServices(db,config);const server=http.createServer((...args)=>createHttpApp(svc,config)(...args));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true})})
 const base='http://127.0.0.1:'+server.address().port+'/api/v1',u=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get(),admin=db.prepare("SELECT * FROM users WHERE role='admin'").get(),o=await svc.createAdminCounselor(admin,{staffId:'T002'});db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').run(o.id);const other=db.prepare('SELECT * FROM users WHERE id=?').get(o.id)
 async function req(url,token,method='GET',body,binary=false){const r=await fetch(base+url,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,data:r.ok&&binary?Buffer.from(await r.arrayBuffer()):await r.json()}}
 const login=async(role,accountId)=>(await req('/auth/login',null,'POST',{role,accountId,password:'123456'})).data.data.token,ut=await login('counselor','T001'),at=await login('admin','admin'),ot=await login('counselor','T002')
 const students=[];for(let i=0;i<4;i++)students.push(await svc.saveRegistryStudent(u,{name:'测试同学'+i,college:'测试学院',gradeMajor:'2026级计算机1班',levels:{'2026-09':'一级'}}))
 const foreign=await svc.saveRegistryStudent(other,{name:'他人学生',college:'另一学院',gradeMajor:'2026级中文1班',levels:{'2026-09':'一级'}}),entry=i=>({registryStudentId:students[i].id,name:students[i].name,college:'测试学院',grade:'2026级',major:'计算机',entryDate:'2026-09-01',entryLevel:'一级',currentLevel:'一级',kind:i%2?'exit':'downgrade',targetLevel:i%2?'':'二级',remarks:'=1+1',reason:'演示理由，申请心理中心复评。'}),input={semesterId:'2026-1',clientRequestId:crypto.randomUUID(),entries:[entry(0)],status:'draft'};let r
 await t.test('匿名、越权、草稿、幂等重试、加密与并发版本控制',async()=>{
  assert.equal((await req('/grade-applications')).status,401);assert.equal((await req('/grade-applications/statistics',at)).status,404)
  assert.equal((await req('/grade-applications',ut,'POST',{...input,counselorId:o.id})).status,403)
  assert.equal((await req('/grade-applications',ut,'POST',{...input,entries:[{...entry(0),registryStudentId:foreign.id}]})).status,404)
  const created=await req('/grade-applications',ut,'POST',input);assert.equal(created.status,201,JSON.stringify(created));r=created.data.data
  assert.equal((await req('/grade-applications',ut,'POST',input)).data.data.id,r.id);assert.equal((await req('/grade-applications/'+r.id,ot)).status,404)
  assert.equal((await req('/grade-applications',ut,'POST',{...input,entries:[{...entry(0),remarks:'更改后的重试内容'}]})).status,409)
  assert.equal((await req('/grade-applications/'+r.id+'/document?format=xlsx&revision='+r.revision,ut)).status,422)
  assert.equal((await req('/grade-applications?counselorId='+u.id,ot)).data.data.length,0)
  assert.match(db.prepare('SELECT record_json FROM grade_applications WHERE id=?').get(r.id).record_json,/^enc:v1:/)
  const updated=await req('/grade-applications/'+r.id,ut,'PATCH',{...input,revision:1,status:'submitted'});assert.equal(updated.status,200);r=updated.data.data
  assert.equal((await req('/grade-applications/'+r.id,ut,'PATCH',{...input,revision:1})).status,409)
  assert.equal((await req('/grade-applications/'+r.id+'/versions',ot)).status,404)
 })
 await t.test('完整填写校验、等级及日期、同学院分页、管理员不可代填修改',async()=>{
  for(const entries of [[{...entry(0),reason:''}],[{...entry(0),entryDate:'2026-02-30'}],[{...entry(0),targetLevel:'一级'}],[entry(0),entry(0)],[entry(0),{...entry(1),college:'别的学院'}]])assert.equal((await req('/grade-applications',ut,'POST',{...input,clientRequestId:crypto.randomUUID(),status:'submitted',entries})).status,422)
  assert.equal((await req('/grade-applications',at,'POST',input)).status,403)
  assert.equal((await req('/grade-applications/'+r.id,at,'PATCH',{...input,revision:r.revision})).status,403)
  const saved=await req('/grade-applications',ut,'POST',{...input,clientRequestId:crypto.randomUUID(),counselorId:u.id,status:'submitted',entries:[entry(1)]});assert.equal(saved.status,201);assert.equal(saved.data.data.createdByName,u.display_name)
  const edited=await req('/grade-applications/'+r.id,ut,'PATCH',{...input,entries:[entry(0),entry(1),entry(2),entry(3)],status:'submitted',revision:r.revision,centerOpinion:'演示评估意见，请以实际意见为准。',signatureDate:'2026-10-25'});assert.equal(edited.status,200,JSON.stringify(edited));r=edited.data.data
  const versions=(await req('/grade-applications/'+r.id+'/versions',at)).data.data;assert.equal(versions.length,3);assert.equal(versions[0].actorName,u.display_name);assert.equal(versions[2].entries.length,1);assert.ok(versions.every(v=>v.createdAt))
 })
 await t.test('原表样式、固定几何、公式注入防护与4人两页PDF',async()=>{
  const exported=await req('/grade-applications/'+r.id+'/document?format=xlsx&revision='+r.revision,ut,'GET',undefined,true);assert.equal(exported.status,200)
  const w=new ExcelJS.Workbook();await w.xlsx.load(exported.data);const s=w.worksheets[0];assert.equal(s.getCell('B3').text,students[0].name);assert.equal(s.getCell('J3').text,'=1+1');assert.equal(s.getCell('J3').type,ExcelJS.ValueType.String);assert.equal(s.getCell('B10').text,students[3].name);assert.equal(s.getCell('A7').text,'心理中心评估后意见：演示评估意见，请以实际意见为准。');assert.match(s.getCell('A6').text,/2026年10月25日/);assert.equal(s.getRow(3).height,69);assert.equal(s.getRow(4).height,56);assert.equal(s.getRow(5).height,49);assert.equal(s.pageSetup.orientation,'portrait');assert.ok(s.model.merges.includes('A13:K13'))
  const actual=await JSZip.loadAsync(exported.data),original=await JSZip.loadAsync(fs.readFileSync(path.join(__dirname,'../templates/grade-application/blank.xlsx'))),parser=new DOMParser(),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',serial=new XMLSerializer(),doc=parser.parseFromString(await actual.file('xl/worksheets/sheet1.xml').async('string'),'application/xml'),orig=parser.parseFromString(await original.file('xl/worksheets/sheet1.xml').async('string'),'application/xml')
  for(const tag of ['cols','pageMargins','sheetFormatPr'])assert.equal(serial.serializeToString(doc.getElementsByTagNameNS(ns,tag)[0]),serial.serializeToString(orig.getElementsByTagNameNS(ns,tag)[0]))
  const styles=parser.parseFromString(await actual.file('xl/styles.xml').async('string'),'application/xml'),oldStyles=parser.parseFromString(await original.file('xl/styles.xml').async('string'),'application/xml');for(const tag of ['fonts','fills'])assert.equal(serial.serializeToString(styles.getElementsByTagNameNS(ns,tag)[0]),serial.serializeToString(oldStyles.getElementsByTagNameNS(ns,tag)[0]))
  const borders=Array.from(styles.getElementsByTagNameNS(ns,'borders')[0].childNodes).filter(n=>n.nodeType===1),oldBorders=Array.from(oldStyles.getElementsByTagNameNS(ns,'borders')[0].childNodes).filter(n=>n.nodeType===1),xfs=Array.from(styles.getElementsByTagNameNS(ns,'cellXfs')[0].childNodes).filter(n=>n.nodeType===1)
  oldBorders.forEach((border,i)=>assert.equal(serial.serializeToString(borders[i]),serial.serializeToString(border)))
  for(const titleRow of [1,8])for(let col=0;col<11;col++){
   const address=String.fromCharCode(65+col)+titleRow,c=Array.from(doc.getElementsByTagNameNS(ns,'c')).find(c=>c.getAttribute('r')===address),border=borders[Number(xfs[Number(c.getAttribute('s'))].getAttribute('borderId'))],edge=side=>border.getElementsByTagNameNS(ns,side)[0].getAttribute('style')||''
   assert.equal(edge('top'),'thin',address+' must close the top frame');assert.equal(edge('bottom'),'thin',address+' must retain the title divider');assert.equal(edge('left'),col===0?'thin':'',address+' must not add internal title dividers');assert.equal(edge('right'),col===10?'thin':'',address+' must close the right frame only at K')
  }
  assert.equal((await req('/grade-applications/'+r.id+'/document?revision=1',ut)).status,409)
  const pdf=await req('/grade-applications/'+r.id+'/document?format=pdf&revision='+r.revision,ut,'GET',undefined,true);assert.equal(pdf.status,200,Buffer.isBuffer(pdf.data)?'':JSON.stringify(pdf.data));assert.equal((await PDFDocument.load(pdf.data)).getPageCount(),2)
  const printed=await PDFDocument.load(pdf.data)
  for(let page=0;page<printed.getPageCount();page++){
   const one=await PDFDocument.create();one.addPage((await one.copyPages(printed,[page]))[0]);const geometry=await require('../src/talk-document').pdfGeometry(await one.save()),horizontal=geometry.lines.filter(([x,y,x2,y2])=>x2-x>300&&Math.abs(y-y2)<0.1),top=Math.max(...horizontal.map(l=>l[1])),bottom=Math.min(...horizontal.map(l=>l[1])),left=Math.min(...horizontal.map(l=>l[0])),right=Math.max(...horizontal.map(l=>l[2]))
   for(const x of [left,right])assert.ok(geometry.lines.some(([x1,y1,x2,y2])=>Math.abs(x1-x)<0.6&&Math.abs(x2-x)<0.6&&Math.abs(Math.max(y1,y2)-top)<0.6&&Math.abs(Math.min(y1,y2)-bottom)<0.6),'PDF page '+(page+1)+' must have both sides meeting the top and bottom frame, without a dangling title border')
  }
  const preview=await req('/grade-applications/'+r.id+'/document?format=preview&revision='+r.revision,at);assert.equal(preview.status,200);assert.equal(preview.data.data.pages.length,2);assert.ok(preview.data.data.pages.every(p=>p.startsWith('data:image/png;base64,')));assert.equal((await PDFDocument.load(Buffer.from(preview.data.data.pdfBase64,'base64'))).getPageCount(),2)
 })
 await t.test('过长内容可完整保存但禁止截断打印；关闭重开仍保留',async()=>{
  assert.equal(checkGradePrintable({...r,entries:[{...entry(0),reason:'长内容'.repeat(100)}]}).ready,false)
  const saved=await req('/grade-applications/'+r.id,ut,'PATCH',{...input,entries:[{...entry(0),reason:'长内容'.repeat(100)}],revision:r.revision,status:'submitted'});assert.equal(saved.status,200);r=saved.data.data
  assert.equal((await req('/grade-applications/'+r.id+'/document?format=xlsx&revision='+r.revision,ut)).status,422)
  db.close();db=openDatabase(file);svc=createServices(db,config);const restored=await svc.getGradeApplication(u,r.id);assert.equal(restored.entries[0].reason,'长内容'.repeat(100));assert.equal((await svc.getGradeApplicationVersions(u,r.id)).length,4)
 })
})
