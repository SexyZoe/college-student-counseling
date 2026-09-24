// Run once against a clean deployment; read the temporary password from the environment.
const crypto = require('node:crypto');
const {loadConfig} = require('../src/config');
const {openConfiguredDatabase, inTransaction} = require('../src/database');
const {createPasswordRecordAsync, normalizeAccountId} = require('../src/security');

async function bootstrapAdmin(database, input) {
  const accountId=normalizeAccountId(input.accountId);
  const password=String(input.password||'');
  const name=String(input.displayName||'系统管理员').trim();
  if(!/^[a-z0-9][a-z0-9_.-]{2,49}$/.test(accountId))throw new Error('管理员账号需为3至50位字母、数字、点、下划线或短横线');
  if(password.length<12||password.length>64)throw new Error('管理员临时密码需为12至64位');
  if(!name||name.length>50)throw new Error('管理员姓名需为1至50字');
  const record=await createPasswordRecordAsync(password);
  return inTransaction(database,async()=>{
    if(await database.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get())throw new Error('已有管理员，拒绝重复初始化或覆盖现有密码');
    const id='admin-'+crypto.randomUUID(),now=new Date().toISOString();
    await database.prepare(`INSERT INTO users (id,role,account_id,password_hash,password_salt,display_name,active,created_at,profile_completed,must_change_password,auth_version)
      VALUES (?,'admin',?,?,?,?,1,?,1,1,0)`).run(id,accountId,record.hash,record.salt,name,now);
    await database.prepare(`INSERT INTO audit_logs (actor_user_id,action,target_type,target_id,details_json,created_at) VALUES (?,'初始化管理员','user',?,'{}',?)`).run(id,id,now);
    return {accountId,mustChangePassword:true};
  });
}
async function main(){
  const config=loadConfig();
  if(config.seedDemoData)throw new Error('初始化正式管理员前必须设置 SEED_DEMO_DATA=false');
  const database=await openConfiguredDatabase(config);
  try{const result=await bootstrapAdmin(database,{accountId:process.env.BOOTSTRAP_ADMIN_ACCOUNT||'admin',password:process.env.BOOTSTRAP_ADMIN_PASSWORD,displayName:process.env.BOOTSTRAP_ADMIN_NAME});console.log(JSON.stringify(result));}
  finally{delete process.env.BOOTSTRAP_ADMIN_PASSWORD;await database.close()}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={bootstrapAdmin};
