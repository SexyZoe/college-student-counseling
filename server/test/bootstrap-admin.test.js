const test=require('node:test'),assert=require('node:assert/strict');
const {openDatabase}=require('../src/database');
const {bootstrapAdmin}=require('../scripts/bootstrap-admin');
const {verifyPasswordAsync}=require('../src/security');
test('无演示数据环境可初始化管理员，并禁止覆盖现有账号',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  await assert.rejects(bootstrapAdmin(db,{accountId:'admin',password:'short'}),/12至64/);
  await bootstrapAdmin(db,{accountId:'admin',password:'Temporary-Only-9284'});
  const row=db.prepare("SELECT * FROM users WHERE role='admin'").get();assert.equal(row.must_change_password,1);
  assert.ok(await verifyPasswordAsync('Temporary-Only-9284',row.password_salt,row.password_hash));
  await assert.rejects(bootstrapAdmin(db,{accountId:'another',password:'Different-password'}),/已有管理员/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count,1);
});
