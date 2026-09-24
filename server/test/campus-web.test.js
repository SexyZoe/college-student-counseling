const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {openDatabase,seedDemoData}=require('../src/database');
const {createServices}=require('../src/services');
const {createHttpApp}=require('../src/app');
const scoring=require('../../utils/scoring-engine');
const assessments=require('../../shared/assessments.json');

test('校园网页：Cookie、CSRF、8套量表、同意留痕、幂等和角色隔离',async t=>{
  const db=openDatabase(':memory:');await seedDemoData(db);
  const config={authSecret:'campus-web-test-secret',tokenTtlSeconds:3600,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000};
  const services=createServices(db,config,{now:()=>Date.parse('2026-09-24T04:00:00Z')});
  const server=http.createServer(createHttpApp(services,config));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));db.close()});
  const base='http://127.0.0.1:'+server.address().port;
  let cookie;
  async function req(path,body,headers={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','X-Requested-With':'campus-web',...(cookie?{cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    return {response,body:await response.json()};
  }
  await t.test('登录只设置HttpOnly Cookie，不向网页返回令牌',async()=>{
    const r=await req('/api/v1/auth/login',{client:'web',role:'student',accountId:'2024001',password:'123456'});
    assert.equal(r.response.status,200);assert.equal(r.body.data.token,undefined);
    const set=r.response.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);cookie=set.split(';')[0];
    assert.equal((await req('/api/v1/account')).body.data.role,'student');
  });
  await t.test('没有自定义头或跨域来源不能通过Cookie执行写操作',async()=>{
    const r=await req('/api/v1/auth/logout',{}, {'X-Requested-With':''});assert.equal(r.response.status,403);
    assert.equal((await req('/api/v1/auth/logout',{}, {origin:'https://attacker.invalid'})).response.status,403);
    assert.equal((await req('/api/v1/account')).response.status,200);
  });
  const catalog=(await req('/api/v1/student/catalog')).body.data;
  assert.equal(catalog.assessments.reduce((n,a)=>n+a.questions.length,0),114);
  function payload(a,index){return {assessmentId:a.id,submissionId:'web-test:'+a.id+':'+index,questionnaireVersion:a.questionnaireVersion,scoringVersion:a.scoringVersion,consent:true,consentVersion:catalog.consentVersion,answers:Object.fromEntries(a.questions.map((q,i)=>[i,(i+index)%4]))}}
  await t.test('未同意、旧版本、未答完以及非法索引均被拒绝',async()=>{
    const p=payload(assessments[0],0);
    assert.equal((await req('/api/v1/student/submissions',{...p,consent:false})).response.status,422);
    assert.equal((await req('/api/v1/student/submissions',{...p,questionnaireVersion:'old'})).response.status,409);
    assert.equal((await req('/api/v1/student/submissions',{...p,answers:{0:1}})).response.status,422);
    assert.equal((await req('/api/v1/student/submissions',{...p,answers:{...p.answers,0:'1x'}})).response.status,422);
  });
  await t.test('所有114题迁移后的评分与原评分引擎一致，且重复提交只保存一次',async()=>{
    for(const a of assessments){
      const p=payload(a,1);const r=await req('/api/v1/student/submissions',p);
      assert.equal(r.response.status,201,JSON.stringify(r.body));
      const expected=scoring.scoreAssessment({assessmentId:a.id,questions:a.questions,answers:p.answers,rule:scoring.getRule(a.id)});
      assert.equal(r.body.data.result.score,expected.rawScore, '量表 '+a.id);
      assert.equal(r.body.data.result.stdScore,expected.wellbeingIndex);
      assert.equal(r.body.data.result.riskLevel,expected.riskLevel);
      const retry=await req('/api/v1/student/submissions',p);assert.equal(retry.body.data.result.id,r.body.data.result.id);assert.equal(retry.body.data.idempotent,true);
    }
    const results=(await req('/api/v1/assessment-results/me')).body.data;assert.equal(results.length,8);
    const logs=db.prepare("SELECT details_json FROM audit_logs WHERE action='提交测评结果'").all();assert.equal(logs.length,8);
    for(const log of logs){assert.equal(JSON.parse(log.details_json).consentVersion,catalog.consentVersion);assert.ok(JSON.parse(log.details_json).consentAt)}
  });
  await t.test('学生无法调用管理接口，退出会撤销会话',async()=>{
    assert.equal((await req('/api/v1/admin/students')).response.status,403);
    const out=await req('/api/v1/auth/logout',{});assert.equal(out.response.status,200);assert.match(out.response.headers.get('set-cookie'),/Max-Age=0/);
    assert.equal((await req('/api/v1/account')).response.status,401);
  });
  await t.test('生产环境Cookie必须Secure',async()=>{
    const prod=http.createServer(createHttpApp(services,{...config,nodeEnv:'production',trustProxy:true}));await new Promise(r=>prod.listen(0,'127.0.0.1',r));
    try{const r=await fetch('http://127.0.0.1:'+prod.address().port+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json','X-Requested-With':'campus-web','X-Forwarded-Proto':'https'},body:JSON.stringify({client:'web',role:'admin',accountId:'admin',password:'123456'})});assert.match(r.headers.get('set-cookie'),/; Secure/)}finally{await new Promise(r=>prod.close(r))}
  });
});
