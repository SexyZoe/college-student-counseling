// Local preview and browser tests only. All people and records are fabricated.
const {openDatabase,seedDemoData}=require('../server/src/database')
const {createServices}=require('../server/src/services')
async function weeklyFixture(){
 const db=openDatabase(':memory:');await seedDemoData(db)
 const config={authSecret:'local-weekly-preview',dataEncryptionKey:'cd'.repeat(32),tokenTtlSeconds:86400,maxBodyBytes:1048576,logLevel:'error',generalRateLimitPerMinute:10000,loginRateLimitPerMinute:1000,weeklyPreview:true}
 const services=createServices(db,config),user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get(),admin=db.prepare("SELECT * FROM users WHERE role='admin'").get()
 await services.createSemester(admin,{name:'2026-2027学年第二学期',startDate:'2027-02-22',endDate:'2027-07-09'})
 await services.counselorProfile(user,{displayName:'王老师（演示）',college:'信息工程学院',contact:'010-00000001'})
 const other=await services.createAdminCounselor(admin,{staffId:'T002'});db.prepare('UPDATE users SET must_change_password=0 WHERE id=?').run(other.id)
 const second=db.prepare('SELECT * FROM users WHERE id=?').get(other.id)
 await services.counselorProfile(second,{displayName:'李老师（演示）',college:'人文学院',contact:'010-00000002'})
 const p={semesterId:'2026-1',weekStart:'2026-10-19'},people=[]
 for(const [i,name,owner,status] of [[1,'演示同学甲',user,'completed'],[2,'演示同学乙',user,'draft'],[3,'演示同学丙',user,'pending'],[4,'演示同学丁',user,'completed'],[5,'演示同学戊',second,'completed'],[6,'演示同学己',second,'pending']]){
  const student=await services.saveRegistryStudent(owner,{college:i<5?'信息工程学院':'人文学院',name,gender:i%2?'女':'男',gradeMajor:i<5?'2026级计算机1班':'2026级汉语言1班',campus:i<5?'东校区':'南校区',major:i<5?'计算机科学与技术':'汉语言文学',studentNo:'DEMO2026'+String(i).padStart(3,'0'),phone:'010-0000000'+i,dorm:(i<5?'学苑1号楼':'学苑2号楼')+'-'+(300+i),counselorInfo:i<5?'王老师 / 010-00000001':'李老师 / 010-00000002',studentSupport:'演示帮扶同学 / 班委 / 010-00000100',levels:{'2026-09':'一级'}})
  people.push(student)
  if(status!=='pending')await services.saveWeeklyRecord(owner,student.id,{...p,campus:student.campus,major:student.major,status,revision:0,psychologicalStatus:status==='draft'?'已完成本周初次联系，待补充后续跟进情况。':'本周已面谈，主要交流课程适应与作息安排。学生能够表达近期感受，已约定下周继续联系。',notes:status==='draft'?'待本周再次沟通后补全。':'保持与班级帮扶同学的联系，按约定跟进。'})
  if(i===1)await services.saveWeeklyRecord(owner,student.id,{...p,weekStart:'2026-10-12',campus:student.campus,major:student.major,status:'completed',revision:0,psychologicalStatus:'上周已联系，了解课程安排与宿舍适应情况，约定本周面谈。',notes:'此为虚构往周记录。'})
 }
 await services.saveRegistryStudent(user,{college:'信息工程学院',name:'二级演示同学',gradeMajor:'2026级计算机1班',levels:{'2026-10':'二级'}})
 return {db,config,services,people,period:p}
}
module.exports={weeklyFixture}
