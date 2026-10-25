const {weeklyFixture}=require('./weekly-fixture')
async function committeeFixture(){
 const f=await weeklyFixture(),{db,services}=f,user=db.prepare("SELECT * FROM users WHERE id='counselor-t001'").get(),admin=db.prepare("SELECT * FROM users WHERE role='admin'").get(),second=db.prepare("SELECT * FROM users WHERE staff_no='T002'").get(),classes=[]
 for(const [name,college,campus,owner,n]of [['2026级计算机科学与技术1班','信息工程学院','东校区',user,2],['2026级软件工程1班','信息工程学院','东校区',user,2],['2026级网络工程1班','信息工程学院','南校区',user,0],['2026级汉语言文学1班','人文学院','南校区',second,2]]){
  const c=await services.saveCommitteeClass(owner,{semesterId:'2026-1',college,campus,name});classes.push(c)
  for(let i=0;i<n;i++)await services.saveCommitteeMember(owner,c.id,{name:'演示委员'+['甲','乙','丙','丁','戊','己','庚','辛'][(classes.length-1)*2+i],gender:i%2?'男':'女',phone:'010-00000'+String(classes.length*10+i).padStart(3,'0'),studentNo:'DEMO-C'+classes.length+i})
 }
 for(const college of ['信息工程学院','人文学院'])await services.saveCommitteeHeaders(college==='信息工程学院'?user:second,{college,schoolTeacherName:'校心理老师（演示）',schoolTeacherContact:'010-00000101',collegeLeaderName:'学院负责人（演示）',collegeLeaderContact:'010-00000102',revision:0})
 return {...f,committeeClasses:classes}
}
module.exports={committeeFixture}
