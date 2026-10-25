const {committeeFixture}=require('./committee-fixture')
function entry(student,index=0){return {registryStudentId:student.id,name:student.name,college:student.college,grade:'2026级',major:student.major,entryDate:'2026-09-01',entryLevel:'一级',currentLevel:'一级',kind:index%2?'exit':'downgrade',targetLevel:index%2?'':'二级',remarks:'虚构演示',reason:'此为虚构演示理由：已持续跟进，拟申请复评，具体结论以心理中心评估为准。'}}
async function applicationFixture(){const f=await committeeFixture(),{db,services,people}=f,first=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get(),second=db.prepare("SELECT * FROM users WHERE staff_no='T002'").get(),applications=[]
 for(const [owner,list,status]of [[first,people.slice(0,2),'submitted'],[first,people.slice(2,4),'draft'],[second,people.slice(4,6),'submitted']])applications.push(await services.saveGradeApplication(owner,{semesterId:'2026-1',clientRequestId:require('node:crypto').randomUUID(),entries:list.map(entry),status,centerOpinion:'',signatureDate:''}))
 return {...f,applications}
}
module.exports={applicationFixture,entry}
