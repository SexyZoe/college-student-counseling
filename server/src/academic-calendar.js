const {HttpError}=require('./errors')
const {validDate}=require('./registry-levels')
const day=(date,amount)=>new Date(Date.parse(date+'T00:00:00Z')+amount*86400000).toISOString().slice(0,10)
const monday=date=>day(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7))
function validateFirstMonday(firstMonday,startDate,endDate){
 if(!validDate(firstMonday)||monday(firstMonday)!==firstMonday)throw new HttpError(422,'WEEKLY_CALENDAR_INVALID','第1教学周起始日期必须是有效的周一')
 if(firstMonday<monday(startDate)||firstMonday>monday(endDate))throw new HttpError(422,'WEEKLY_CALENDAR_INVALID','第1教学周须在学期起止日期覆盖的周内')
 return firstMonday
}
function semesterInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(422,'INVALID_SEMESTER','学期设置格式不正确')
 const name=typeof input.name==='string'?input.name.trim():''
 if(!name||name.length>160||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(422,'INVALID_SEMESTER','请填写160字以内的学期名称')
 const {startDate,endDate}=input
 if(!validDate(startDate)||!validDate(endDate)||startDate>endDate)throw new HttpError(422,'INVALID_SEMESTER','请填写有效的学期起止日期，结束日期不能早于开始日期')
 if(Date.parse(endDate)-Date.parse(startDate)>366*86400000)throw new HttpError(422,'INVALID_SEMESTER','单个学期的日期范围不能超过一年')
 const firstMonday=Object.hasOwn(input,'firstMonday')?validateFirstMonday(input.firstMonday,startDate,endDate):null
 return {name,startDate,endDate,firstMonday}
}
module.exports={day,monday,validateFirstMonday,semesterInput}
