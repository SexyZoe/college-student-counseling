/* Current staff registry UI, tested on an isolated in-memory database. */
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const http=require('node:http')
const {chromium,webkit}=require('playwright')
const ExcelJS=require('../server/node_modules/exceljs')
const {openDatabase,seedDemoData}=require('../server/src/database')
const {createServices}=require('../server/src/services')
const {createHttpApp}=require('../server/src/app')
;(async()=>{
 const db=openDatabase(':memory:');await seedDemoData(db)
 const config={authSecret:'registry-browser-test',dataEncryptionKey:'cd'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
 const service=createServices(db,config);const server=http.createServer(createHttpApp(service,config));await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const base='http://127.0.0.1:'+server.address().port
 const out=path.resolve('artifacts');fs.mkdirSync(out,{recursive:true})
 let browser
 try{
  const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium
  browser=await engine.launch({headless:true,...(process.env.BROWSER_CHANNEL&&engine===chromium?{channel:process.env.BROWSER_CHANNEL}:{})})
  const errors=[]
  async function page(width=1440){const c=await browser.newContext({viewport:{width,height:1000}});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  async function login(p,role,id,password='123456'){await p.goto(base+'/web/');await p.locator('#login-role').selectOption(role);await p.locator('#login-account').fill(id);await p.locator('#login-password').fill(password);await p.locator('#login-form [type=submit]').click()}
  const p=await page();await p.goto(base+'/web/');await p.locator('#login-form').waitFor();assert.equal(await p.locator('#login-role option').count(),2);await p.screenshot({path:path.join(out,'registry-login.png'),fullPage:true})
  await login(p,'counselor','T001');await p.locator('#new-record').waitFor()
  await p.locator('[data-page=account]').click();await p.locator('#profile-form [name=displayName]').fill('王辅导员');await p.locator('[name=college]').fill('信息工程学院');await p.locator('[name=contact]').fill('13800001111');await p.locator('#profile-form [type=submit]').click();await p.getByText('个人资料已保存',{exact:true}).waitFor()
  await p.locator('[data-page=registry]').click();await p.locator('#new-record').click();await p.locator('#record-form [name=name]').fill('演示同学甲');await p.locator('[name=gender]').fill('女');await p.locator('[name=gradeMajor]').fill('2026级计算机科学与技术');await p.locator('[name=phone]').fill('0013800012345');await p.locator('[name=dorm]').fill('东区3栋201');await p.locator('[name=studentNo]').fill('00001234');await p.locator('[name=studentSupport]').fill('演示同学乙 / 班长 / 13800002222');await p.locator('[name=leaderSupport]').fill('演示老师 / 学院帮扶');await p.locator('[name=remarks]').fill('演示资料，仅用于功能验证。\n按月更新关怀情况。');await p.locator('[name=ratingLevel]').fill('一级');await p.locator('[name=ratingMonth]').fill('2026-09');await p.locator('[name=ratingLevel]').fill('关注');await p.screenshot({path:path.join(out,'registry-student-form.png'),fullPage:true});await p.locator('#record-form [type=submit]').click();await p.getByText('学生档案已保存',{exact:true}).waitFor();await p.locator('td strong').filter({hasText:'演示同学甲'}).waitFor()
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registry_students').get().n,1)
  await p.locator('[data-edit]').first().click();await p.locator('[name=ratingMonth]').fill('2026-09');assert.equal(await p.locator('[name=ratingLevel]').inputValue(),'关注');await p.locator('#record-cancel').click()
  const book=new ExcelJS.Workbook(),s=book.addWorksheet('学生注册表');s.mergeCells('A1:D1');s.getCell('A1').value='心理问题学生注册表';s.addRow(['学院','姓名','年级专业','联系方式','宿舍','2026年10月等级','备注','学号']);s.addRow(['信息工程学院','导入同学乙','2026级软件工程','00123456','西区201','二级','演示导入记录','00005678']);s.addRow(['人文学院','导入同学丙','2025级汉语言文学','00123457','西区202','关注','演示导入记录','00005679'])
  await p.locator('#import-open').click();await p.locator('#import-form input[type=file]').setInputFiles({name:'注册表.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())});await p.locator('#import-form [type=submit]').click();await p.locator('#confirm-import').waitFor();await p.screenshot({path:path.join(out,'registry-import-preview.png'),fullPage:true});await p.locator('#confirm-import').click();await p.getByText('已成功导入 2 条学生档案',{exact:true}).waitFor();await p.locator('td strong').filter({hasText:'导入同学乙'}).waitFor()
  await p.screenshot({path:path.join(out,'registry-counselor-desktop.png'),fullPage:true})
  const firstCheck=p.locator('[data-select]').first();await firstCheck.check();const selectedId=await firstCheck.getAttribute('data-select')
  const dl=p.waitForEvent('download');await p.locator('#export-download').click();const download=await dl;const exported=new ExcelJS.Workbook();await exported.xlsx.readFile(await download.path());assert.equal(exported.worksheets[0].rowCount,3)
  await p.evaluate(()=>{window.print=()=>{window.printCalled=true}});await p.locator('#print-open').click();await p.waitForFunction(()=>window.printCalled);assert.equal(await p.locator('#print-sheet tbody tr').count(),1);assert.equal(await p.locator('#print-sheet th').count(),12)
  await p.locator('#select-all').check();await p.locator('#print-open').click();await p.waitForFunction(()=>document.querySelectorAll('#print-sheet tbody tr').length===3)
  await p.emulateMedia({media:'print'});await p.screenshot({path:path.join(out,'registry-print.png'),fullPage:true});if(engine===chromium)await p.pdf({path:path.join(out,'registry-print.pdf'),preferCSSPageSize:true,printBackground:true});await p.emulateMedia({media:'screen'})
  await p.locator('#select-all').uncheck();assert.ok(selectedId)
  const admin=await page();await login(admin,'admin','admin');await admin.locator('#new-record').waitFor();await admin.locator('td strong').filter({hasText:'演示同学甲'}).waitFor();await admin.locator('[data-page=counselors]').click();await admin.locator('#counselor-form [name=staffId]').fill('T009');await admin.locator('#counselor-form [type=submit]').click();await admin.getByRole('cell',{name:'T009',exact:true}).first().waitFor();await admin.screenshot({path:path.join(out,'registry-admin-accounts.png'),fullPage:true})
  await admin.locator('[data-view-owner]').filter({hasText:'查看负责学生'}).last().click();await admin.locator('#filter-form').waitFor();assert.equal(await admin.locator('[data-edit]').count(),0)
  const fresh=await page();await login(fresh,'counselor','T009');await fresh.locator('#password-form').waitFor();await fresh.locator('[name=current]').fill('123456');await fresh.locator('[name=next]').fill('NewCounselor123');await fresh.locator('[name=confirm]').fill('NewCounselor123');await fresh.locator('#password-form [type=submit]').click();await fresh.locator('#login-form').waitFor();await login(fresh,'counselor','T009','NewCounselor123');await fresh.locator('#new-record').waitFor();assert.equal(await fresh.locator('[data-edit]').count(),0)
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,'registry-mobile.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await p.locator('#new-record').click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.locator('#record-cancel').click()
  assert.equal(await p.evaluate(()=>localStorage.getItem('shuzhi-web-token')),null);assert.equal(await p.evaluate(()=>document.cookie.includes('campus_session')),false)
  const fixtureUser=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
  for(let i=0;i<65;i++)await service.saveRegistryStudent(fixtureUser,{college:'分页测试学院',name:'分页同学'+i,gradeMajor:'2026级示例专业',remarks:'多页打印验证：每页应保留完整表头。'.repeat(8),levels:{'2026-10':'关注'}})
  await p.setViewportSize({width:1440,height:1000});await p.locator('#filter-form').evaluate(f=>f.requestSubmit());await p.waitForFunction(()=>document.querySelectorAll('[data-edit]').length===68)
  await p.locator('#print-open').click();await p.waitForFunction(()=>document.querySelectorAll('#print-sheet tbody tr').length===68)
  await p.emulateMedia({media:'print'});if(engine===chromium)await p.pdf({path:path.join(out,'registry-print-multipage.pdf'),preferCSSPageSize:true,printBackground:true});await p.emulateMedia({media:'screen'})
  await p.locator('#logout').click();await p.locator('#login-form').waitFor();assert.equal(await p.locator('#print-sheet tbody tr').count(),0);assert.equal(await p.locator('#modal').textContent(),'');assert.equal(await p.evaluate(()=>window.Registry.state.rows.length),0);assert.equal(await p.evaluate(()=>window.Registry.state.profile),null)
  assert.deepEqual(errors,[])
  console.log('PASS: two-role login, self profile, manual registration, monthly history, Excel preview/confirm, selected export, 12-column print/PDF, admin account creation, first-login password change, counselor isolation, mobile layout and logout; no browser JS errors')
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));db.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
