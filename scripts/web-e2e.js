/* Run against an isolated fixture database, never against production. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {chromium,webkit} = require('playwright');
const {openDatabase,seedDemoData} = require('../server/src/database');
const {createServices} = require('../server/src/services');
const {createHttpApp} = require('../server/src/app');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'campus-browser-'));
  const db=openDatabase(':memory:');await seedDemoData(db);
  const config={authSecret:'browser-test-secret',tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000,uploadDirectory:dir};
  const server=http.createServer(createHttpApp(createServices(db,config,{now:()=>Date.parse('2026-09-24T04:00:00Z')}),config));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
    browser=await engine.launch({headless:true,...(process.env.BROWSER_CHANNEL&&engine===chromium?{channel:process.env.BROWSER_CHANNEL}:{})});
    const errors=[];
    async function context(width=390){const c=await browser.newContext({viewport:{width,height:844}});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());return {c,p}}
    async function login(p,role,account,password){await p.goto(base+'/web/');await p.locator('#login-role').selectOption(role);await p.locator('#login-account').fill(account);await p.locator('#login-password').fill(password);await p.locator('#login-form button').click()}
    async function go(p,route,selector){await p.evaluate(route=>location.hash=route,route);await p.waitForFunction(route=>window.Campus?.state.view===route,route);await p.locator(selector).first().waitFor()}
    const student=await context();const p=student.p;
    await login(p,'student','2024001','123456');await p.getByText('你好，张同学。').waitFor();
    assert.equal(await p.evaluate(()=>localStorage.getItem('shuzhi-web-token')),null);
    assert.equal(await p.evaluate(()=>document.cookie.includes('campus_session')),false);
    const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
    fs.mkdirSync(path.resolve('artifacts'),{recursive:true});await p.screenshot({path:'artifacts/student-home-mobile.png',fullPage:true});
    await go(p,'quiz/1','#assessment-consent');assert.equal(await p.locator('#start-quiz').isDisabled(),true);
    await p.locator('#assessment-consent').check();await p.locator('#start-quiz').click();
    await p.locator('input[name=answer]').nth(1).check();await p.locator('#next').click();
    await p.reload();await p.locator('.question').waitFor();assert.match(await p.locator('.quiz-card').innerText(),/2 \/ 20/);
    await p.locator('[data-index="0"]').click();assert.equal(await p.locator('input[name=answer]').nth(1).isChecked(),true);
    // Complete all questions using real browser actions.
    for(let i=0;i<20;i++){await p.locator(`[data-index="${i}"]`).click();await p.locator('input[name=answer]').nth(i%4).check()}
    await student.c.setOffline(true);await p.locator('#next').click();await p.getByText('尚未确认保存。',{exact:false}).waitFor();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_results').get().n,0);
    await p.screenshot({path:'artifacts/quiz-offline-mobile.png',fullPage:true});
    await student.c.setOffline(false);await p.locator('#next').click();await p.locator('.result-card').waitFor();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_results').get().n,1);
    await p.screenshot({path:'artifacts/student-result-mobile.png',fullPage:true});
    await go(p,'history','#history-filter');await p.locator('#history-filter').selectOption('1');await p.getByRole('button',{name:'查看结果',exact:true}).waitFor();
    for(const [route,selector] of [['reading','#article-search'],['civics','#article-search'],['faq','#faq-search'],['help','a[href="tel:120"]'],['privacy','.article-body'],['personality/quiz','[data-choice]']]) await go(p,route,selector);
    for(let i=0;i<28;i++)await p.locator('[data-choice="0"]').click();await p.getByText('探索结果',{exact:true}).waitFor();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_results').get().n,1);
    const admin=await context(1365);await login(admin.p,'admin','admin','123456');await admin.p.getByText('学生账号',{exact:true}).first().waitFor();
    await go(admin.p,'tasks','#task-form');await admin.p.locator('[name=title]').fill('浏览器迁移测试任务');await admin.p.locator('[name=deadline]').fill('2026-12-20');await admin.p.locator('#task-form button').click();await admin.p.getByRole('cell',{name:'浏览器迁移测试任务',exact:true}).waitFor();
    const row=admin.p.getByRole('row').filter({hasText:'浏览器迁移测试任务'});await row.getByRole('button',{name:'发布任务'}).click();await row.getByRole('button',{name:'结束任务'}).waitFor();
    await go(admin.p,'semesters','#semester-form');await admin.p.locator('[name=name]').fill('浏览器新学期');await admin.p.locator('[name=startDate]').fill('2027-02-01');await admin.p.locator('[name=endDate]').fill('2027-07-01');await admin.p.locator('#semester-form button').click();await admin.p.getByText('浏览器新学期',{exact:true}).waitFor();
    await go(admin.p,'students','#roster-file');await admin.p.locator('#roster-file').setInputFiles({name:'student.csv',mimeType:'text/csv',buffer:Buffer.from('班级,学号\n浏览器测试班,2099001\n')});await admin.p.locator('#confirm-import').click();await admin.p.getByRole('cell',{name:'2099001',exact:true}).waitFor();
    await admin.p.screenshot({path:'artifacts/admin-roster-desktop.png',fullPage:true});
    const fresh=await context();await login(fresh.p,'student','2099001','9001');await fresh.p.locator('#profile-form').waitFor();await fresh.p.locator('[name=displayName]').fill('测试同学');await fresh.p.locator('[name=consent]').check();await fresh.p.locator('#profile-form button').first().click();await fresh.p.locator('#password-form').waitFor();
    await fresh.p.locator('[name=current]').fill('9001');await fresh.p.locator('[name=next]').fill('New-Test-password-1');await fresh.p.locator('[name=confirm]').fill('New-Test-password-1');await fresh.p.locator('#password-form button').first().click();await fresh.p.locator('#login-form').waitFor();
    await login(fresh.p,'student','2099001','New-Test-password-1');await fresh.p.getByText('你好，测试同学。').waitFor();
    const counselor=await context(1280);await login(counselor.p,'counselor','T001','123456');await counselor.p.getByText('班级概览',{exact:true}).waitFor();await go(counselor.p,'classes','.class-card');await counselor.p.locator('.class-card[data-class="CS2401"]').click();await counselor.p.locator('.student-summary').first().click();await counselor.p.getByText('张同学 · 支持摘要').waitFor();
    await go(counselor.p,'risks','.save-risk');await counselor.p.locator('.risk-note').first().fill('浏览器测试跟进记录');await counselor.p.locator('.save-risk').first().click();await counselor.p.getByText('跟进记录已保存',{exact:true}).waitFor();
    await go(counselor.p,'articles','#article-form');await counselor.p.locator('#article-title').fill('浏览器测试文章');await counselor.p.locator('#article-content').fill('已审核的校园支持文章正文。');await counselor.p.locator('#article-form button').click();await counselor.p.getByRole('heading',{name:'浏览器测试文章'}).waitFor();assert.equal(await counselor.p.locator('.approve').count(),0);
    await go(admin.p,'content','.approve');const article=admin.p.locator('article').filter({hasText:'浏览器测试文章'});await article.locator('.approve').click();await article.getByText('已发布',{exact:true}).waitFor();
    await go(p,'reading','#article-search');await p.getByRole('heading',{name:'浏览器测试文章'}).waitFor();
    await p.route('**/api/v1/content-items?type=psychoeducation',async route=>{await new Promise(r=>setTimeout(r,300));await route.continue()});
    await go(p,'dashboard','.student-hero');
    await p.evaluate(()=>location.hash='reading');await p.waitForFunction(()=>window.Campus.state.view==='reading');
    await go(p,'privacy','.article-body');await p.waitForTimeout(500);assert.equal(await p.getByRole('heading',{name:'关于你的信息'}).count(),1);
    await p.locator('#menu').click();await p.locator('#logout').click();await p.locator('#login-form').waitFor();
    assert.deepEqual(errors,[]);console.log('PASS: mobile login, consent, refresh recovery, offline retry, scoring, history, personality, first-login setup, task publication, semester, roster import, counselor scope/follow-up, article review, logout; no JS errors or mobile overflow');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
