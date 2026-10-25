/* Writes fabricated records. Run only against an isolated acceptance database. */
const assert=require('node:assert/strict')
const crypto=require('node:crypto')
const ExcelJS=require('exceljs')
const JSZip=require('jszip')
const {DOMParser}=require('@xmldom/xmldom')
const {pdfGeometry,ISSUE_OPTIONS}=require('../src/talk-document')
const base=String(process.env.BASE_URL||'http://127.0.0.1:8787').replace(/\/$/,'')
const suffix=crypto.randomBytes(5).toString('hex').toUpperCase()
const sessions=[]
async function request(route,token,method='GET',body,binary=false){
 const response=await fetch(base+'/api/v1'+route,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{})},...(body?{body:Buffer.isBuffer(body)?body:JSON.stringify(body)}:{})})
 return {status:response.status,data:binary&&response.ok?Buffer.from(await response.arrayBuffer()):await response.json()}
}
async function ok(route,token,method,body,status=200,binary=false){const r=await request(route,token,method,body,binary);assert.equal(r.status,status,route+': '+(Buffer.isBuffer(r.data)?'binary':JSON.stringify(r.data)));return binary?r.data:r.data.data}
async function login(role,id,password='123456'){const r=await ok('/auth/login',null,'POST',{role,accountId:id,password});sessions.push(r.token);return r.token}
async function main(){
 if(process.env.CONTRACT_TEST_ALLOW_WRITES!=='true')throw new Error('此验收会写入虚构数据，仅限隔离测试库；确认后设置 CONTRACT_TEST_ALLOW_WRITES=true')
 const admin=await login('admin','admin'),one=await login('counselor','T001')
 try{
  assert.equal((await request('/registry/students')).status,401)
  assert.equal((await request('/auth/login',null,'POST',{role:'student',accountId:'2024001',password:'123456'})).status,403)
  const staffId='CT'+suffix
  await ok('/admin/counselors',admin,'POST',{staffId},201)
  let two=await login('counselor',staffId)
  assert.equal((await request('/registry/students',two)).status,403)
  const password='Contract-'+crypto.randomUUID()
  await ok('/account/password',two,'POST',{currentPassword:'123456',newPassword:password})
  two=await login('counselor',staffId,password)
  await ok('/counselor/profile',two,'PATCH',{displayName:'虚构验收辅导员',college:'验收学院',contact:'000000'})
  const student={name:'虚构验收学生',college:'验收学院',gender:'女',gradeMajor:'2026级验收专业',studentNo:'CONTRACT'+suffix,phone:'001234',levels:{'2026-10':'关注'}}
  let saved=await ok('/registry/students',one,'POST',student,201)
  saved=await ok('/registry/students/'+saved.id,one,'PATCH',{...saved,levels:{...saved.levels,'2026-11':'一级'}})
  assert.deepEqual(saved.levels,{'2026-10':'关注','2026-11':'一级'})
  assert.equal((await request('/registry/students/'+saved.id,two)).status,404)
  assert.equal((await ok('/registry/students/'+saved.id,admin)).id,saved.id)
  const exported=await ok('/registry/export?month=2026-10&ids='+saved.id,one,'GET',null,200,true)
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(exported)
  assert.equal(workbook.worksheets[0].getCell('C3').text,student.name)
  assert.equal((await ok('/registry/print',one,'POST',{month:'2026-10',ids:saved.id})).length,1)
  const imported=new ExcelJS.Workbook(),sheet=imported.addWorksheet('虚构注册表')
  sheet.addRow(['学院','姓名','年级专业','联系方式','2026年10月等级','学号'])
  sheet.addRow(['验收学院','虚构导入学生','2026级验收专业','001234','关注','IMPORT'+suffix])
  const preview=await ok('/registry/import/preview?month=2026-10',one,'POST',Buffer.from(await imported.xlsx.writeBuffer()),201)
  assert.equal(preview.invalid,0);assert.equal(preview.total,1)
  const confirmation=await ok('/registry/import/'+preview.id+'/confirm',one,'POST',{})
  assert.equal(confirmation.imported,1)
  assert.deepEqual(await ok('/registry/import/'+preview.id+'/confirm',one,'POST',{}),confirmation)
  const talk={registryStudentId:saved.id,name:'虚构学生',gender:'女',college:'验收学院',gradeClass:'2026级验收1班',studentNo:student.studentNo,talkDate:'2026-10-24',issues:[1],otherIssue:'',content:'虚构验收记录，仅用于验证保存、预览及导出。',clientRequestId:crypto.randomUUID()}
  let record=await ok('/talk-records',one,'POST',talk,201)
  assert.equal((await ok('/talk-records',one,'POST',talk,201)).id,record.id)
  assert.equal((await request('/talk-records/'+record.id,two)).status,404)
  assert.equal((await request('/talk-records/'+record.id,admin,'PATCH',record)).status,403)
  const old=record
  record=await ok('/talk-records/'+record.id,one,'PATCH',{...record,content:'虚构验收记录已修改。约定后续联系。'})
  assert.equal(record.revision,2);assert.equal(record.createdAt,old.createdAt)
  assert.equal((await request('/talk-records/'+record.id,one,'PATCH',old)).status,409)
  const word=await ok('/talk-records/'+record.id+'/document?format=docx',admin,'GET',null,200,true)
  const zip=await JSZip.loadAsync(word),doc=new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'),'application/xml')
  const row=doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','tr')[2]
  assert.equal(row.textContent,'近期心理困扰：1. '+ISSUE_OPTIONS[0])
  const pdf=await ok('/talk-records/'+record.id+'/document?format=pdf&preview=1&revision=2',one,'GET',null,200,true)
  assert.equal((await pdfGeometry(pdf)).pages,1)
  const legacyWord=await ok('/talk-records/'+record.id+'/document?format=doc',admin,'GET',null,200,true)
  assert.equal(legacyWord.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1')
  await require('./forms-contract-test').verifyForms({admin,one,two,suffix,base,ok,request})
  console.log('PASS: staff-only auth, first-login password change, self profile, owner isolation, registry history/import/export/print, independent talk save/retry/edit, administrator access, selected-only original-form DOCX/PDF/DOC')
 }finally{for(const token of sessions)await request('/auth/logout',token,'POST',{}).catch(()=>{})}
}
main().catch(e=>{console.error('Staff contract failed: '+e.message);process.exitCode=1})
