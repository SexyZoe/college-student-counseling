/* Staff conversation workflow, isolated fixture database and fabricated content. */
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const http=require('node:http')
const {chromium,webkit}=require('playwright')
const {openDatabase,seedDemoData}=require('../server/src/database')
const {createServices}=require('../server/src/services')
const {createHttpApp}=require('../server/src/app')
;(async()=>{
 const db=openDatabase(':memory:');await seedDemoData(db)
 const config={authSecret:'talk-browser-tests',dataEncryptionKey:'cc'.repeat(32),tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000}
 const service=createServices(db,config),server=http.createServer(createHttpApp(service,config));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port
 const user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get()
 await service.saveRegistryStudent(user,{name:'测试同学',gender:'女',college:'信息学院',gradeMajor:'2026级计算机',studentNo:'TEST0001',levels:{}})
 let browser
 try{
  const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium
  browser=await engine.launch({headless:true,...(process.env.BROWSER_CHANNEL&&engine===chromium?{channel:process.env.BROWSER_CHANNEL}:{})})
  const errors=[],out=path.resolve('artifacts');fs.mkdirSync(out,{recursive:true})
  const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));let acceptClose=false;p.on('dialog',d=>acceptClose?d.accept():d.dismiss())
  async function login(p,role,id){await p.goto(base+'/web/');await p.locator('#login-role').selectOption(role);await p.locator('#login-account').fill(id);await p.locator('#login-password').fill('123456');await p.locator('#login-form [type=submit]').click();await p.locator(role==='admin'?'.admin-material-grid':'#new-record').waitFor()}
  await login(p,'counselor','T001');await p.locator('[data-page=talks]').click();await p.locator('#new-talk').click();await p.locator('#talk-form [name=registryStudentId]').selectOption({index:1});assert.equal(await p.locator('#talk-form [name=name]').inputValue(),'测试同学');await p.locator('#talk-form [name=gradeClass]').fill('2026级计算机1班');await p.locator('#talk-form [name=talkDate]').fill('2026-10-24');await p.locator('#talk-form [name=issues][value="4"]').check();await p.locator('#talk-form [name=issues][value="5"]').check();await p.locator('#talk-form [name=content]').fill('本次为虚构谈话测试记录。\n了解近期学习安排，约定后续联系。');await p.screenshot({path:path.join(out,'talk-form-edit.png'),fullPage:true})
  await p.locator('#talk-cancel').click();assert.equal(await p.locator('#modal').evaluate(e=>e.open),true)
  await p.locator('#talk-form [type=submit]').click();await p.locator('#talk-word').waitFor();await p.getByText('当前显示已保存版本。',{exact:true}).waitFor();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talk_records').get().n,1)
  await p.locator('#talk-form [name=content]').fill('本次为虚构测试记录。了解近期学习安排，约定后续联系。');assert.equal(await p.locator('#talk-preview').isDisabled(),true);await p.locator('#talk-form [type=submit]').click();await p.getByText('当前显示已保存版本。',{exact:true}).waitFor();assert.equal(db.prepare('SELECT revision FROM talk_records').get().revision,2)
  const downloadPromise=p.waitForEvent('download');await p.locator('#talk-word').click();const word=await downloadPromise;assert.equal(fs.readFileSync(await word.path()).subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1')
  await p.locator('#talk-preview').click();await p.locator('#talk-pdf-frame').waitFor();assert.match(await p.locator('#talk-pdf-frame').getAttribute('src'),/^blob:/);await p.screenshot({path:path.join(out,'talk-original-preview.png'),fullPage:true});await p.locator('#talk-back').click();await p.locator('#talk-cancel').click();await p.locator('[data-talk]').first().waitFor();await p.screenshot({path:path.join(out,'talk-records-list.png'),fullPage:true})
  await p.locator('#new-talk').click();await p.locator('#talk-form [name=name]').fill('草稿同学');await p.locator('#talk-form [name=content]').fill('尚未完成的记录');await p.locator('#talk-form [type=submit]').click();await p.getByText('当前显示已保存版本。',{exact:true}).waitFor();await p.locator('#talk-cancel').click();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM talk_records').get().n,2)
  await p.locator('#talk-filter [name=q]').fill('草稿同学');await p.locator('#talk-filter [type=submit]').click();await p.waitForFunction(()=>document.querySelectorAll('[data-talk]').length===1);await p.locator('#talk-reset').click();await p.waitForFunction(()=>document.querySelectorAll('[data-talk]').length===2)
  const admin=await browser.newPage({viewport:{width:1440,height:1000}});admin.on('pageerror',e=>errors.push(e.message));await login(admin,'admin','admin');await admin.locator('[data-page=talks]').click();await admin.locator('[data-talk]').first().waitFor();assert.equal(await admin.locator('#new-talk').count(),0);await admin.locator('#talk-filter [name=q]').fill('测试同学');await admin.locator('#talk-filter [type=submit]').click();await admin.waitForFunction(()=>document.querySelectorAll('[data-talk]').length===1);await admin.locator('[data-talk]').first().click();await admin.locator('#talk-form').waitFor();assert.equal(await admin.locator('#talk-form [name=content]').isDisabled(),true);assert.equal(await admin.locator('#talk-form [type=submit]').count(),0);assert.equal(await admin.locator('#talk-word').isEnabled(),true);await admin.screenshot({path:path.join(out,'talk-admin-view.png'),fullPage:true});await admin.locator('#talk-cancel').click()
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,'talk-mobile-list.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.locator('[data-talk]').first().click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.locator('#talk-cancel').click();await p.locator('#logout').click();await p.locator('#login-form').waitFor();assert.equal(await p.locator('#modal').textContent(),'');assert.deepEqual(errors,[])
  console.log('PASS: counselor student autofill, independent drafts, unsaved-change guard, save/edit timestamps, original DOC export, actual PDF preview, administrator read-only access, date/student filtering, mobile layout and logout cleanup')
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));db.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
