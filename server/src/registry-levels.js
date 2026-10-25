const {HttpError}=require('./errors')
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
function isLevelOne(value){return /^(一级|1级|一|1|Ⅰ|I)$/i.test(String(value||'').normalize('NFKC').replace(/\s/g,''))}
function levelHistory(record){
 const entries=Array.isArray(record.levelHistory)?record.levelHistory.filter(e=>record.levels?.[e.month]&&validDate(e.effectiveDate)):[]
 const result=entries.map(e=>({...e}))
 for(const [month,level]of Object.entries(record.levels||{}))if(!entries.some(e=>e.month===month))result.push({month,level,effectiveDate:month+'-01',recordedAt:''})
 return result.map((e,index)=>({...e,index})).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||a.recordedAt.localeCompare(b.recordedAt)||a.index-b.index)
}
function updateLevelHistory(existing,record,input,now){
 const dates=input.levelEffectiveDates||{}
 if(typeof dates!=='object'||Array.isArray(dates))throw new HttpError(422,'REGISTRY_LEVEL_DATE_INVALID','评级生效日期格式不正确')
 for(const [month,date]of Object.entries(dates))if(!validDate(date)||date.slice(0,7)!==month)throw new HttpError(422,'REGISTRY_LEVEL_DATE_INVALID','评级生效日期必须在对应月份内')
 const history=levelHistory(existing||{levels:{}}).filter(e=>record.levels[e.month]).map(({index,...e})=>e)
 for(const [month,level]of Object.entries(record.levels)){
  const previous=existing?.levels?.[month],last=history.filter(e=>e.month===month).at(-1),date=dates[month]
  if(level!==previous||!last)history.push({month,level,effectiveDate:date||month+'-01',recordedAt:now})
  else if(date&&date!==last.effectiveDate)last.effectiveDate=date
 }
 if(history.length>3000)throw new HttpError(422,'REGISTRY_LEVEL_HISTORY_LIMIT','评级记录过多，请联系管理员整理')
 return history
}
function weeklyLevel(record,start,end){
 const history=levelHistory(record),before=history.filter(e=>e.effectiveDate<=start).at(-1),within=history.filter(e=>e.effectiveDate>start&&e.effectiveDate<=end)
 const qualifying=[before,...within].filter(e=>e&&isLevelOne(e.level))
 const latest=history.filter(e=>e.effectiveDate<=end).at(-1)
 return {eligible:qualifying.length>0,level:latest?.level||'',effectiveDate:latest?.effectiveDate||'',qualifiedDate:qualifying.at(-1)?.effectiveDate||''}
}
module.exports={validDate,isLevelOne,levelHistory,updateLevelHistory,weeklyLevel}
