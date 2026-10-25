const ExcelJS = require('exceljs')
const { HttpError } = require('./errors')

function labelMonth(month) { const [year, m] = month.split('-'); return year + '年' + Number(m) + '月等级' }
function headers(month) { return ['序号','学院','姓名','性别','年级专业','联系方式','宿舍','辅导员/联系方式','学生帮扶/班级职务/联系方式','领导帮扶',labelMonth(month),'备注','学号（选填）'] }
function cells(record, index, month) { return [index + 1,record.college,record.name,record.gender,record.gradeMajor,record.phone,record.dorm,record.counselorInfo,record.studentSupport,record.leaderSupport,record.levels[month] || '',record.remarks,record.studentNo] }
function text(cell) {
  const value = cell.value
  if (value == null) return ''
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new HttpError(422,'WORKBOOK_CELL_INVALID','不接受公式单元格，请将公式粘贴为值后上传')
    if (value.richText) return value.richText.map(v => v.text).join('')
    if (value.text !== undefined) return String(value.text)
    if (value instanceof Date) return value.toISOString().slice(0,10)
    throw new HttpError(422,'WORKBOOK_CELL_INVALID','含有无法读取的单元格类型')
  }
  // Preserve display formatting for identifiers with leading zeroes.
  return String(cell.text || value).trim()
}
const clean = value => value.replace(/[\s/／、（）()_—\-]/g,'')
const aliases = {
  college:['学院','院系'], name:['姓名','学生姓名'], gender:['性别'], gradeMajor:['年级专业','年级及专业','年级与专业'],
  phone:['联系方式','联系电话','学生联系方式','学生电话'], dorm:['宿舍','寝室','宿舍号'],
  counselorInfo:['辅导员联系方式','辅导员及联系方式','辅导员'], studentSupport:['学生帮扶班级职务联系方式','学生帮扶','学生帮扶及联系方式'],
  leaderSupport:['领导帮扶','帮扶领导'], remarks:['备注'], studentNo:['学号','学号选填','学生学号']
}
function identify(value, defaultMonth) {
  const normalized = clean(value)
  for (const [key, names] of Object.entries(aliases)) if (names.includes(normalized)) return key
  const dated = normalized.match(/^(\d{4})年(\d{1,2})月等级$/)
  if (dated && Number(dated[2]) >= 1 && Number(dated[2]) <= 12) return 'level:' + dated[1] + '-' + dated[2].padStart(2,'0')
  if (['等级','关注等级','心理等级'].includes(normalized)) return 'level:' + defaultMonth
  return ''
}
function validateZip(buffer) {
  if (buffer.length > 5 * 1024 * 1024) throw new HttpError(413, 'WORKBOOK_TOO_LARGE', 'Excel 文件不能超过5MB')
  let end = -1
  for (let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--) if(buffer.readUInt32LE(i)===0x06054b50){end=i;break}
  if(end<0) throw new HttpError(422,'WORKBOOK_INVALID','请上传有效的 .xlsx 文件；旧版 .xls 请另存为 .xlsx')
  let offset=buffer.readUInt32LE(end+16), total=buffer.readUInt16LE(end+10), inflated=0
  if(total>500) throw new HttpError(422,'WORKBOOK_TOO_COMPLEX','Excel 文件结构过于复杂，请使用登记模板')
  for(let i=0;i<total;i++) {
    if(offset+46>buffer.length || buffer.readUInt32LE(offset)!==0x02014b50) throw new HttpError(422,'WORKBOOK_INVALID','Excel 文件目录损坏')
    inflated+=buffer.readUInt32LE(offset+24)
    if(inflated>30*1024*1024) throw new HttpError(413,'WORKBOOK_TOO_LARGE','Excel 解压后过大，请拆分文件')
    offset+=46+buffer.readUInt16LE(offset+28)+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32)
  }
}
async function readRegistryWorkbook(buffer, month) {
  validateZip(buffer)
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.load(buffer) } catch (_) { throw new HttpError(422,'WORKBOOK_INVALID','无法读取 Excel，请确认文件未加密且为 .xlsx 格式') }
  const candidates=[]
  for(const sheet of workbook.worksheets) {
    if(sheet.state !== 'visible') continue
    if(sheet.rowCount>2040 || sheet.columnCount>100) throw new HttpError(422,'WORKBOOK_LIMIT','每次最多导入2000条学生记录、100列，请拆分文件')
    for(let start=1;start<=Math.min(sheet.rowCount,40);start++) {
      for(let depth=1;depth<=3 && start+depth-1<=sheet.rowCount;depth++) {
        const mapping={}
        for(let col=1;col<=sheet.columnCount;col++) {
          const parts=[]
          for(let n=0;n<depth;n++) { const v=text(sheet.getRow(start+n).getCell(col)); if(v && parts[parts.length-1]!==v) parts.push(v) }
          const key=identify(parts.join(''),month)
          if(key) { if(Object.values(mapping).includes(key)) throw new HttpError(422,'WORKBOOK_HEADER_DUPLICATE','登记表存在重复字段列，请检查表头'); mapping[col]=key }
        }
        if(['name','college','gradeMajor'].every(key=>Object.values(mapping).includes(key))) {
          let header=start+depth-1
          // Vertically merged headings may span additional physical header rows.
          for(const col of Object.keys(mapping)) {
            const master=sheet.getRow(start).getCell(Number(col)).master
            let end=header
            while(end+1<=sheet.rowCount && end-start<2) {
              const next=sheet.getRow(end+1).getCell(Number(col))
              if(!next.isMerged || next.master.address!==master.address)break
              end++
            }
            header=Math.max(header,end)
          }
          if(header>start+depth-1) {
            for(let col=1;col<=sheet.columnCount;col++) {
              const parts=[]
              for(let row=start;row<=header;row++){const v=text(sheet.getRow(row).getCell(col));if(v&&parts[parts.length-1]!==v)parts.push(v)}
              const key=identify(parts.join(''),month)
              if(key)mapping[col]=key
            }
          }
          candidates.push({sheet,header,mapping});break
        }
      }
      if(candidates.some(c=>c.sheet===sheet)) break
    }
  }
  if(candidates.length!==1) throw new HttpError(422,'WORKBOOK_HEADERS',candidates.length?'检测到多个登记工作表，请每次只保留一个需要导入的登记表':'未找到学院、姓名、年级专业表头，请使用登记模板')
  const {sheet,header,mapping}=candidates[0], rows=[]
  for(let n=header+1;n<=sheet.rowCount;n++) {
    const record={levels:{}}, excelRow=sheet.getRow(n)
    let nonempty=false, cellError=''
    for(const [col,key] of Object.entries(mapping)) {
      let value=''
      try { value=text(excelRow.getCell(Number(col))) } catch(error) { cellError=error.message }
      if(value)nonempty=true
      if(key.startsWith('level:')) { if(value)record.levels[key.slice(6)]=value }
      else record[key]=value
    }
    if(!nonempty && !cellError)continue
    if(cellError) throw new HttpError(422,'WORKBOOK_CELL_INVALID','第'+n+'行：'+cellError)
    rows.push({rowNumber:n,record})
  }
  if(!rows.length) throw new HttpError(422,'WORKBOOK_EMPTY','登记表没有可导入的学生数据')
  if(rows.length>2000) throw new HttpError(422,'WORKBOOK_LIMIT','每次最多导入2000条学生记录')
  return {sheetName:sheet.name,rows}
}
async function writeRegistryWorkbook(rows, month) {
  const workbook=new ExcelJS.Workbook()
  workbook.creator='数智心港湾'
  const sheet=workbook.addWorksheet('心理问题学生注册表', {views:[{state:'frozen',ySplit:2}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:2',margins:{left:0.25,right:0.25,top:0.4,bottom:0.4,header:0.2,footer:0.2}}})
  sheet.mergeCells('A1:M1');sheet.getCell('A1').value='心理问题学生注册表';sheet.getRow(1).height=32
  sheet.getRow(1).font={name:'宋体',size:18,bold:true};sheet.getRow(1).alignment={horizontal:'center',vertical:'middle'}
  sheet.addRow(headers(month));sheet.getRow(2).height=62
  const widths=[7,16,12,8,24,18,16,25,32,22,16,35,20]
  widths.forEach((width,i)=>{sheet.getColumn(i+1).width=width;sheet.getColumn(i+1).numFmt='@'})
  for(let i=0;i<rows.length;i++)sheet.addRow(cells(rows[i],i,month))
  if(!rows.length) for(let i=0;i<5;i++)sheet.addRow(Array(13).fill(''))
  for(let n=2;n<=sheet.rowCount;n++) {
    const row=sheet.getRow(n);row.height=n===2?62:Math.max(40, Math.min(240, Math.max(...row.values.filter(v=>typeof v==='string').map(v=>v.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/12)),0)),1)*16))
    row.eachCell({includeEmpty:true},cell=>{cell.font={name:'宋体',size:11,bold:n===2};cell.alignment={wrapText:true,vertical:'middle',horizontal:n===2?'center':'left'};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}}})
  }
  sheet.pageSetup.printArea='A1:M'+sheet.rowCount
  sheet.headerFooter.oddFooter='&C第 &P 页 / 共 &N 页'
  return Buffer.from(await workbook.xlsx.writeBuffer())
}
module.exports={readRegistryWorkbook,writeRegistryWorkbook,headers,cells,labelMonth}
