// Read-only production configuration check; never prints secret values.
const fs=require('node:fs');
const {loadConfig}=require('../server/src/config');
const problems=[];
try{loadConfig({...process.env,NODE_ENV:'production'})}catch(error){problems.push(error.message)}
for(const name of ['SCHOOL_NAME','SUPPORT_PHONE','SUPPORT_LOCATION','SUPPORT_HOURS','PRIVACY_CONTACT','RETENTION_NOTICE']){
  const value=String(process.env[name]||'').trim();
  if(!value||value==='校园'||/待确认/.test(value))problems.push(name+' 尚未配置为学校确认的信息');
}
try{const url=new URL(process.env.CAMPUS_SITE_URL);if(url.protocol!=='https:'||url.username||url.password)throw new Error()}catch(_){problems.push('CAMPUS_SITE_URL 必须是正式校园 HTTPS 入口')}
if(process.env.SEED_DEMO_DATA!=='false')problems.push('必须显式设置 SEED_DEMO_DATA=false');
if(!process.env.SCHOOL_RELEASE_RECORD)problems.push('需提供学校上线确认记录路径 SCHOOL_RELEASE_RECORD（包含量表、隐私和风险响应确认）');
else if(!fs.existsSync(process.env.SCHOOL_RELEASE_RECORD))problems.push('学校上线确认记录文件不存在');
if(problems.length){console.error('尚未满足正式接入真实学生的条件：\n'+problems.map(x=>' - '+x).join('\n'));process.exitCode=1}
else console.log('配置预检通过。仍需核对学校记录的内容、实际 TLS、网络隔离、真机验收及恢复演练；本检查不替代业务批准。');
