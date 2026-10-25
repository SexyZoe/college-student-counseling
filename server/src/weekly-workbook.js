const fs=require('node:fs/promises')
const path=require('node:path')
const crypto=require('node:crypto')
const ExcelJS=require('exceljs')
const {HttpError}=require('./errors')
const WEEKLY_HEADERS=['序号','学院','校区','姓名','性别','专业','联系方式','宿舍','辅导员/联系方式','学生帮扶/班级职务/联系方式','心理状况','备注']
const template=path.join(__dirname,'..','templates','weekly-ledger')
function weeklyCells(record,index){const s=record.snapshot;const status={pending:'未填写',draft:'草稿'}[record.status];return [index+1,s.college,s.campus,s.name,s.gender,s.major,s.phone,s.dorm,s.counselorInfo,s.studentSupport,record.psychologicalStatus+(status?'\n（'+status+'）':''),record.notes]}
async function writeWeeklyWorkbook(rows,period){
 const source=await fs.readFile(path.join(template,'original.xlsx')),manifest=JSON.parse(await fs.readFile(path.join(template,'manifest.json'),'utf8'))
 if(crypto.createHash('sha256').update(source).digest('hex')!==manifest.sha256)throw new Error('周台账模板校验失败')
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(source)
 const sheet=workbook.worksheets[0],styles=Array.from({length:12},(_,i)=>structuredClone(sheet.getRow(4).getCell(i+1).style))
 const widths=Array.from({length:12},(_,i)=>sheet.getColumn(i+1).width||9)
 sheet.getCell('A2').value=period.label
 for(let n=4;n<=Math.max(sheet.rowCount,rows.length+3);n++)for(let col=1;col<=12;col++)sheet.getRow(n).getCell(col).value=null
 for(let index=0;index<rows.length;index++){
  const values=weeklyCells(rows[index],index),row=sheet.getRow(index+4)
  const lines=values.map((value,i)=>String(value??'').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(Array.from(line).reduce((n,c)=>n+(/^[\x20-\x7e]$/.test(c)?0.6:1),0)/Math.max(3,widths[i]/2))),0))
  const height=Math.max(34,Math.max(...lines)*15+8)
  if(height>409)throw new HttpError(422,'WEEKLY_EXPORT_OVERFLOW','第'+(index+1)+'名学生的文字超过 Excel 单行打印容量，请精简本周心理状况或备注后导出；已保存内容完整保留')
  row.height=height
  values.forEach((value,i)=>{const cell=row.getCell(i+1);cell.style=structuredClone(styles[i]);cell.value=value===''?null:value??null;cell.alignment={...cell.alignment,wrapText:true,vertical:'middle'};if(i>0)cell.numFmt='@'})
 }
 sheet.views=[{state:'frozen',ySplit:3,xSplit:4}]
 sheet.pageSetup={...sheet.pageSetup,paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:3',printArea:'A1:L'+Math.max(4,rows.length+3)}
 return Buffer.from(await workbook.xlsx.writeBuffer())
}
module.exports={writeWeeklyWorkbook,WEEKLY_HEADERS,weeklyCells}
