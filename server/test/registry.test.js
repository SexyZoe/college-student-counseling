const test=require('node:test')
const assert=require('node:assert/strict')
const http=require('node:http')
const ExcelJS=require('exceljs')
const {openDatabase,seedDemoData}=require('../src/database')
const {createServices}=require('../src/services')
const {createHttpApp}=require('../src/app')
const {writeRegistryWorkbook,readRegistryWorkbook}=require('../src/registry-workbook')

const config={authSecret:'registry-test-secret',dataEncryptionKey:'ab'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
const student=(name='测试学生',extra={})=>({name,college:'信息学院',gender:'女',gradeMajor:'2026级计算机',phone:'0013812345678',dorm:'东区101',studentSupport:'同学甲 / 班长 / 001234',leaderSupport:'领导乙',counselorInfo:'王老师 / 10086',remarks:'需要持续关怀\n保持联系',studentNo:'',levels:{'2026-10':'一级'},...extra})

test('学生登记闭环：权限、档案、月度历史、导入导出与打印',async t=>{
 const db=openDatabase(':memory:');await seedDemoData(db)
 const services=createServices(db,config)
 const server=http.createServer(createHttpApp(services,config));await new Promise(r=>server.listen(0,'127.0.0.1',r))
 t.after(async()=>{await new Promise(r=>server.close(r));db.close()})
 const base='http://127.0.0.1:'+server.address().port
 async function req(path,token,method='GET',body,binary=false){const r=await fetch(base+'/api/v1'+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{})},...(body?{body:Buffer.isBuffer(body)?body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,data:binary&&r.ok?Buffer.from(await r.arrayBuffer()):await r.json()}}
 async function login(role,accountId,password='123456'){return req('/auth/login',null,'POST',{role,accountId,password})}
 const admin=(await login('admin','admin')).data.data.token
 const first=(await login('counselor','T001')).data.data.token
 let second,secondId,saved,previewId
 await t.test('默认只允许管理员和辅导员登录；匿名访问被拒绝',async()=>{
  assert.equal((await login('student','2024001')).status,403)
  assert.equal((await req('/registry/students')).status,401)
  const response=await fetch(base+'/web/');const html=await response.text();assert.match(html,/registry.js/);assert.doesNotMatch(html,/student.js/)
 })
 await t.test('管理员仅填写工号即可开通账号，首次必须改密',async()=>{
  const r=await req('/admin/counselors',admin,'POST',{staffId:'T002'});assert.equal(r.status,201);secondId=r.data.data.id;assert.equal(r.data.data.displayName,'T002')
  let r2=await login('counselor','T002');second=r2.data.data.token
  assert.equal((await req('/registry/students',second)).status,403)
  assert.equal((await req('/account/password',second,'POST',{currentPassword:'123456',newPassword:'CounselorNew123'})).status,200)
  second=(await login('counselor','T002','CounselorNew123')).data.data.token
 })
 await t.test('辅导员自行维护资料，不能修改身份与他人资料',async()=>{
  let r=await req('/counselor/profile',second,'PATCH',{displayName:'李老师',college:'人文学院',contact:'13800000000'});assert.equal(r.status,200);assert.equal(r.data.data.displayName,'李老师')
  assert.equal((await req('/counselor/profile',second,'PATCH',{displayName:'李老师',role:'admin'})).status,422)
  assert.equal((await req('/counselor/profile',admin)).status,403)
 })
 await t.test('手工登记持久保存、加密，后端拒绝伪造归属',async()=>{
  assert.equal((await req('/registry/students',first,'POST',student('伪造',{counselorId:secondId}))).status,403)
  const r=await req('/registry/students',first,'POST',student());assert.equal(r.status,201,JSON.stringify(r.data));saved=r.data.data
  assert.equal(saved.counselorId,'counselor-t001');assert.equal(saved.phone,'0013812345678')
  const row=db.prepare('SELECT record_json FROM registry_students WHERE id = ?').get(saved.id);assert.match(row.record_json,/^enc:v1:/);assert.ok(!row.record_json.includes('测试学生'))
  assert.equal((await req('/registry/students',first,'POST',{name:'缺项'})).status,422)
 })
 await t.test('另一个辅导员无法读取、编辑、筛选、导出或打印他人数据',async()=>{
  assert.equal((await req('/registry/students/'+saved.id,second)).status,404)
  assert.equal((await req('/registry/students/'+saved.id,second,'PATCH',{...saved,name:'篡改'})).status,404)
  assert.equal((await req('/registry/students?counselorId=counselor-t001',second)).data.data.length,0)
  const exported=await req('/registry/export?month=2026-10&ids='+saved.id,second,'GET',null,true);assert.equal(exported.status,200)
  const book=new ExcelJS.Workbook();await book.xlsx.load(exported.data);assert.equal(book.worksheets[0].getCell('C3').text,'')
  assert.deepEqual((await req('/registry/print',second,'POST',{month:'2026-10',ids:saved.id})).data.data,[])
 })
 await t.test('按月补充等级，历史保留；旧版本提交被拒绝',async()=>{
  const r=await req('/registry/students/'+saved.id,first,'PATCH',{...saved,levels:{...saved.levels,'2026-11':'二级'}});assert.equal(r.status,200);assert.deepEqual(r.data.data.levels,{'2026-10':'一级','2026-11':'二级'})
  assert.equal((await req('/registry/students/'+saved.id,first,'PATCH',saved)).status,409)
  saved=r.data.data
 })
 await t.test('管理员可汇总与筛选，但不能代为登记或修改',async()=>{
  assert.equal((await req('/registry/students',admin)).data.data.length,1)
  assert.equal((await req('/registry/students',admin,'POST',student('另一位学生',{counselorId:secondId,studentNo:'000002'}))).status,403)
  assert.equal((await req('/registry/students/'+saved.id,admin,'PATCH',saved)).status,403)
  const r=await req('/registry/students',second,'POST',student('另一位学生',{studentNo:'000002'}));assert.equal(r.status,201)
  assert.equal((await req('/registry/students?counselorId='+secondId,admin)).data.data.length,1)
  assert.equal((await req('/registry/students?q=另一位',admin)).data.data.length,1)
  assert.equal((await req('/registry/students?month=2026-11&level='+encodeURIComponent('二级'),admin)).data.data.length,1)
 })
 await t.test('同名提示需要人工确认，学号重复不能覆盖',async()=>{
  assert.equal((await req('/registry/students',first,'POST',student())).data.error.code,'REGISTRY_POSSIBLE_DUPLICATE')
  assert.equal((await req('/registry/students',first,'POST',student('另一位学生',{studentNo:'000002',acknowledgeDuplicate:true}))).status,409)
 })
 await t.test('原表格式Excel：标题、换行表头、多个等级列、空行和前导零',async()=>{
  const b=new ExcelJS.Workbook(),s=b.addWorksheet('注册表');s.mergeCells('A1:F1');s.getCell('A1').value='学校心理问题学生注册表'
  s.addRow(['学院','姓名','年级专业','联系方式','2026年10月等级','2026年11月等级','学生帮扶/班\n级职务/联系\n方式','学号'])
  s.addRow(['理学院','导入甲','2026级数学','00123','关注','二级','同学 / 班长 / 001','000003']);s.addRow([]);s.addRow(['理学院','导入乙','2026级物理','00234','一级','','','000004'])
  const r=await req('/registry/import/preview?month=2026-10',first,'POST',Buffer.from(await b.xlsx.writeBuffer()));assert.equal(r.status,201,JSON.stringify(r.data));const p=r.data.data;previewId=p.id;assert.equal(p.total,2);assert.equal(p.invalid,0);assert.equal(p.rows[0].rowNumber,3);assert.equal(p.rows[1].rowNumber,5);assert.deepEqual(p.rows[0].record.levels,{'2026-10':'关注','2026-11':'二级'});assert.equal(p.rows[0].record.phone,'00123')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registry_students').get().n,2)
  assert.match(db.prepare('SELECT preview_json FROM registry_imports WHERE id=?').get(previewId).preview_json,/^enc:v1:/)
 })
 await t.test('导入确认只允许预览本人；重复点击只入库一次',async()=>{
  assert.equal((await req('/registry/import/'+previewId+'/confirm',second,'POST',{})).status,404)
  const firstResult=await req('/registry/import/'+previewId+'/confirm',first,'POST',{});assert.equal(firstResult.status,200);assert.equal(firstResult.data.data.imported,2)
  const repeat=await req('/registry/import/'+previewId+'/confirm',first,'POST',{});assert.deepEqual(repeat.data,firstResult.data)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registry_students').get().n,4)
 })
 await t.test('错误行可定位，整个批次不会部分导入',async()=>{
  const b=new ExcelJS.Workbook(),s=b.addWorksheet('表');s.addRow(['学院','姓名','年级专业']);s.addRow(['理学院','正确行','2026级']);s.addRow(['理学院','','2026级'])
  const r=await req('/registry/import/preview?month=2026-10',first,'POST',Buffer.from(await b.xlsx.writeBuffer()));assert.equal(r.status,201);assert.equal(r.data.data.invalid,1);assert.equal(r.data.data.rows[1].rowNumber,3)
  assert.equal((await req('/registry/import/'+r.data.data.id+'/confirm',first,'POST',{})).status,422);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registry_students').get().n,4)
 })
 await t.test('预览后的重复变化会重新校验，已过期预览不能导入',async()=>{
  const buffer=await writeRegistryWorkbook([student('并发甲',{studentNo:'000005'})],'2026-10')
  let r=await req('/registry/import/preview?month=2026-10',first,'POST',buffer);let id=r.data.data.id
  assert.equal((await req('/registry/students',first,'POST',student('并发甲',{studentNo:'000005'}))).status,201)
  assert.equal((await req('/registry/import/'+id+'/confirm',first,'POST',{})).status,409)
  r=await req('/registry/import/preview?month=2026-10',first,'POST',await writeRegistryWorkbook([student('过期甲')],'2026-10'));id=r.data.data.id
  db.prepare('UPDATE registry_imports SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',id)
  assert.equal((await req('/registry/import/'+id+'/confirm',first,'POST',{})).status,410)
 })
 await t.test('导出指定学生与月份，Excel保留原表顺序与横向打印设置，可重新导入',async()=>{
  const r=await req('/registry/export',admin,'POST',{month:'2026-11',ids:saved.id},true);assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment/)
  const b=new ExcelJS.Workbook();await b.xlsx.load(r.data);const s=b.worksheets[0]
  assert.equal(s.getCell('B2').text,'学院');assert.equal(s.getCell('C3').text,'测试学生');assert.equal(s.getCell('K2').text,'2026年11月等级');assert.equal(s.getCell('K3').text,'二级');assert.equal(s.getCell('F3').text,'0013812345678');assert.equal(s.pageSetup.orientation,'landscape');assert.equal(s.pageSetup.printTitlesRow,'1:2')
  const parsed=await readRegistryWorkbook(r.data,'2026-11');assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].record.name,'测试学生')
  const printed=await req('/registry/print',admin,'POST',{month:'2026-11',ids:saved.id});assert.equal(printed.data.data.length,1)
 })
 await t.test('无效文件、无效月份、公式和多工作表均有明确提示',async()=>{
  assert.equal((await req('/registry/import/preview?month=2026-10',first,'POST',Buffer.from('not excel'))).status,422)
  assert.equal((await req('/registry/export?month=2026-99',first)).status,422)
  const b=new ExcelJS.Workbook(),s=b.addWorksheet('表');s.addRow(['学院','姓名','年级专业']);s.addRow(['理学院',{formula:'1+1',result:2},'2026级'])
  assert.equal((await req('/registry/import/preview?month=2026-10',first,'POST',Buffer.from(await b.xlsx.writeBuffer()))).status,422)
  s.getCell('B2').value='甲';const other=b.addWorksheet('表2');other.addRow(['学院','姓名','年级专业']);other.addRow(['理学院','乙','2026级'])
  assert.equal((await req('/registry/import/preview?month=2026-10',first,'POST',Buffer.from(await b.xlsx.writeBuffer()))).status,422)
 })
 await t.test('导出与打印留审计，停用账号后档案仍保留',async()=>{
  const logs=db.prepare("SELECT action, details_json FROM audit_logs WHERE action IN ('导出学生登记表','打印学生登记表')").all();assert.ok(logs.length>=4);assert.ok(logs.every(l=>!l.details_json.includes('测试学生')))
  assert.equal((await req('/admin/counselors/T002/status',admin,'PATCH',{active:false})).status,200)
  assert.equal((await req('/registry/students',second)).status,401)
  assert.equal((await req('/registry/students?counselorId='+secondId,admin)).data.data.length,1)
 })
})

test('SQLite并发保存与同时确认只创建一个批次，并保留所有独立档案',async()=>{
 const db=openDatabase(':memory:');await seedDemoData(db)
 try{
  const service=createServices(db,config),user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
  const saved=await Promise.all([service.saveRegistryStudent(user,student('并发保存甲')),service.saveRegistryStudent(user,student('并发保存乙'))])
  assert.equal(saved.length,2)
  const buffer=await writeRegistryWorkbook([student('并发导入学生',{studentNo:'001234'})],'2026-10')
  const preview=await service.previewRegistryImport(user,buffer,{month:'2026-10'})
  const confirmed=await Promise.all([service.confirmRegistryImport(user,preview.id,{}),service.confirmRegistryImport(user,preview.id,{})])
  assert.deepEqual(confirmed[0],confirmed[1]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registry_students').get().n,3)
  const duplicate=await Promise.allSettled([service.saveRegistryStudent(user,student('重复学号甲',{studentNo:'009999'})),service.saveRegistryStudent(user,student('重复学号乙',{studentNo:'009999'}))])
  assert.equal(duplicate.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(duplicate.find(r=>r.status==='rejected').reason.code,'REGISTRY_DUPLICATE')
 }finally{db.close()}
})

test('学生档案和辅导员个人资料在数据库关闭重开后保持一致',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'registry-persistence-')),file=path.join(dir,'registry.db')
 let db
 try{
  db=openDatabase(file);await seedDemoData(db)
  let service=createServices(db,config),user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
  await service.counselorProfile(user,{displayName:'持久化老师',contact:'00123',college:'信息学院'})
  const record=await service.saveRegistryStudent(user,student('持久化同学',{levels:{'2026-09':'关注','2026-10':'一级'}}))
  db.close();db=openDatabase(file);service=createServices(db,config);user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
  const restored=await service.getRegistryStudent(user,record.id)
  assert.equal(restored.name,'持久化同学');assert.deepEqual(restored.levels,{'2026-09':'关注','2026-10':'一级'})
  assert.equal((await service.counselorProfile(user)).displayName,'持久化老师')
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM schema_migrations WHERE version='008'").get().n,1)
 }finally{if(db)db.close();fs.rmSync(dir,{recursive:true,force:true})}
})

test('两行合并表头和拆行字段均识别为表头，不作为学生数据',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('登记表')
 sheet.addRow(['学院','姓名','年级专业','学生帮扶']);sheet.addRow(['','','','班级职务/联系方式'])
 for(const col of ['A','B','C'])sheet.mergeCells(col+'1:'+col+'2')
 sheet.addRow(['信息学院','合并头同学','2026级计算机','同学甲 / 班长 / 00123'])
 const result=await readRegistryWorkbook(Buffer.from(await book.xlsx.writeBuffer()),'2026-10')
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].rowNumber,3);assert.equal(result.rows[0].record.studentSupport,'同学甲 / 班长 / 00123')
})
