const {HttpError}=require('./errors')
// Business records belong to their counselor. Account administration grants no write access.
function requireDataWriter(user){
 if(user?.role!=='counselor')throw new HttpError(403,'BUSINESS_READ_ONLY',user?.role==='admin'?'管理员仅可查看和导出业务数据，内容由负责辅导员维护':'仅负责辅导员可填写业务数据')
}
module.exports={requireDataWriter}
