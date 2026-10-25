const crypto = require('node:crypto')
const {HttpError} = require('./errors')
const {inTransaction} = require('./database')
const {createTalkDocumentRenderer, checkPrintable, ISSUE_OPTIONS} = require('./talk-document')

const LIMITS = {name:50, gender:10, college:100, gradeClass:200, studentNo:50, otherIssue:200, content:10000, talkDate:10}
function normalizeTalk(input) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new HttpError(422,'TALK_INVALID','谈话记录格式不正确')
  const r={}
  for(const [key,max] of Object.entries(LIMITS)) {
    const value=input[key]??''
    if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new HttpError(422,'TALK_FIELD_INVALID','谈话内容过长或含无效字符：'+key)
    r[key]=value.trim().replace(/\r\n?/g,'\n')
  }
  if(!r.name)throw new HttpError(422,'TALK_NAME_REQUIRED','保存记录前请填写学生姓名')
  if(r.talkDate && (!/^\d{4}-\d{2}-\d{2}$/.test(r.talkDate)||Number.isNaN(Date.parse(r.talkDate+'T00:00:00Z'))||new Date(r.talkDate+'T00:00:00Z').toISOString().slice(0,10)!==r.talkDate))throw new HttpError(422,'TALK_DATE_INVALID','请填写有效的谈话日期')
  if(!Array.isArray(input.issues)||input.issues.some(i=>!Number.isInteger(i)||i<1||i>9))throw new HttpError(422,'TALK_ISSUES_INVALID','请选择原表中的心理困扰选项')
  r.issues=[...new Set(input.issues)].sort((a,b)=>a-b)
  if(r.otherIssue&&!r.issues.includes(9))throw new HttpError(422,'TALK_OTHER_INVALID','填写其他困扰时，请同时选择“其他”')
  return r
}
function createTalkServices(database,config,context) {
  const {requireRole,audit,nowIso,dataProtector,getRegistryStudent}=context
  const renderer=createTalkDocumentRenderer(config)
  const staff=u=>requireRole(u,['admin','counselor'])
  function unpack(row){const r=dataProtector.unprotectJson(row.record_json,'talk:'+row.id);return {...r,id:row.id,counselorId:row.counselor_user_id,counselorName:row.counselor_name||'',registryStudentId:row.registry_student_id||'',revision:Number(row.revision),createdAt:row.created_at,updatedAt:row.updated_at,printCheck:checkPrintable(r)}}
  async function get(user,id){staff(user);const row=await database.prepare('SELECT t.*,u.display_name AS counselor_name FROM talk_records t JOIN users u ON u.id=t.counselor_user_id WHERE t.id=?').get(id);if(!row||(user.role==='counselor'&&row.counselor_user_id!==user.id))throw new HttpError(404,'TALK_NOT_FOUND','谈话记录不存在或无权访问');return unpack(row)}
  async function list(user,filters={}) {
    staff(user)
    for(const k of ['from','to'])if(filters[k]&&!/^\d{4}-\d{2}-\d{2}$/.test(filters[k]))throw new HttpError(422,'TALK_FILTER_INVALID','请选择有效的日期范围')
    if(filters.from&&filters.to&&filters.from>filters.to)throw new HttpError(422,'TALK_FILTER_INVALID','开始日期不能晚于结束日期')
    const args=[],conditions=[]
    if(user.role==='counselor'){conditions.push('t.counselor_user_id=?');args.push(user.id)}else if(filters.counselorId){conditions.push('t.counselor_user_id=?');args.push(String(filters.counselorId))}
    if(filters.registryStudentId){conditions.push('t.registry_student_id=?');args.push(String(filters.registryStudentId))}
    const rows=await database.prepare(`SELECT t.*,u.display_name AS counselor_name FROM talk_records t JOIN users u ON u.id=t.counselor_user_id ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY t.updated_at DESC,t.id`).all(...args)
    const q=String(filters.q||'').trim().toLowerCase()
    return rows.map(unpack).filter(r=>(!q||[r.name,r.studentNo,r.college,r.gradeClass].some(v=>v.toLowerCase().includes(q)))&&(!filters.from||r.talkDate>=filters.from)&&(!filters.to||(r.talkDate&&r.talkDate<=filters.to))).map(({content,otherIssue,...summary})=>({...summary,contentLength:content.length}))
  }
  async function save(user,input,id) {
    requireRole(user,'counselor')
    const record=normalizeTalk(input)
    const existing=id?await get(user,id):null
    const registryId=existing?existing.registryStudentId:String(input.registryStudentId||'')
    if(registryId)await getRegistryStudent(user,registryId)
    const requestId=existing?'':String(input.clientRequestId||'')
    if(!existing&&!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))throw new HttpError(422,'TALK_REQUEST_INVALID','新建记录缺少有效的请求编号，请重新打开填写页面')
    return inTransaction(database,async()=>{
      if(database.dialect==='mysql')await database.prepare('SELECT id FROM users WHERE id=? FOR UPDATE').get(user.id)
      if(!existing){const prior=await database.prepare('SELECT * FROM talk_records WHERE counselor_user_id=? AND client_request_id=?').get(user.id,requestId);if(prior){const old=unpack(prior);if(JSON.stringify(normalizeTalk(old))!==JSON.stringify(record)||(prior.registry_student_id||'')!==registryId)throw new HttpError(409,'TALK_REQUEST_REUSED','这份记录已保存，请重新打开后修改');return get(user,prior.id)}}
      const time=nowIso()
      if(existing){
        if(input.revision!==existing.revision)throw new HttpError(409,'TALK_CHANGED','记录已被修改，请重新打开后编辑；当前内容尚未覆盖')
        const changed=await database.prepare('UPDATE talk_records SET record_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(dataProtector.protectJson(record,'talk:'+id),time,id,input.revision)
        if(!changed.changes)throw new HttpError(409,'TALK_CHANGED','记录已被修改，请重新打开后编辑')
      }else{id=crypto.randomUUID();await database.prepare('INSERT INTO talk_records (id,counselor_user_id,registry_student_id,client_request_id,record_json,revision,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)').run(id,user.id,registryId||null,requestId,dataProtector.protectJson(record,'talk:'+id),time,time)}
      await audit(user.id,existing?'修改学生谈话记录':'保存学生谈话记录','talk_record',id,{revision:existing?existing.revision+1:1,registryStudentId:registryId})
      return get(user,id)
    })
  }
  async function document(user,id,options={}) {
    const record=await get(user,id)
    if(options.revision&&String(record.revision)!==String(options.revision))throw new HttpError(409,'TALK_CHANGED','记录已更新，请刷新后重新导出')
    const format=options.format||'pdf'
    if(!['pdf','doc','docx'].includes(format))throw new HttpError(422,'TALK_FORMAT_INVALID','仅支持 Word 或 PDF 格式')
    if(!record.printCheck.ready)throw new HttpError(422,'TALK_PRINT_INCOMPLETE',record.printCheck.reasons.join('；'))
    const result=await renderer.render(record,format)
    await audit(user.id,options.purpose==='print'?'打印学生谈话表':options.preview==='1'?'预览学生谈话表':'导出学生谈话表','talk_record',id,{revision:record.revision,format})
    return {...result,fileName:'辅导员心理谈话表.'+format}
  }
  async function metadata(user){staff(user);return {issues:ISSUE_OPTIONS,signatureMode:'handwritten',...renderer.capabilities()}}
  return {listTalkRecords:list,getTalkRecord:get,saveTalkRecord:save,exportTalkDocument:document,getTalkMetadata:metadata}
}
module.exports={createTalkServices,normalizeTalk}
