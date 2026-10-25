const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto')
const JSZip=require('jszip')
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom')
const {HttpError}=require('./errors')
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const parse=s=>new DOMParser().parseFromString(s,'application/xml')
const xml=d=>new XMLSerializer().serializeToString(d)
const template=path.join(__dirname,'..','templates','committee-network')
function textCell(d,c,value){
 for(const n of [...c.childNodes])if(['v','is','f'].includes(n.localName))c.removeChild(n)
 c.removeAttribute('t');if(value===''||value==null)return
 c.setAttribute('t','inlineStr');const is=d.createElementNS(NS,'is'),t=d.createElementNS(NS,'t');t.setAttribute('xml:space','preserve');t.appendChild(d.createTextNode(String(value)));is.appendChild(t);c.appendChild(is)
}
function set(d,address,value){const c=[...d.getElementsByTagNameNS(NS,'c')].find(c=>c.getAttribute('r')===address);if(!c)throw new Error('原表缺少单元格 '+address);textCell(d,c,value)}
function groups(rows,key){const result=[];for(let start=0;start<rows.length;){let end=start+1;while(end<rows.length&&key(rows[end])===key(rows[start]))end++;if(end-start>1)result.push([start+5,end+4]);start=end}return result}
function merge(d,parent,address){const node=d.createElementNS(NS,'mergeCell');node.setAttribute('ref',address);parent.appendChild(node)}
const safeName=s=>String(s).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100)
async function writeCommitteeWorkbook(college,rows,headers={}){
 if(rows.length>10000)throw new HttpError(422,'COMMITTEE_EXPORT_LIMIT','每个学院每次最多导出10000行，请缩小查询范围')
 const bytes=await fs.readFile(path.join(template,'blank.xlsx')),manifest=JSON.parse(await fs.readFile(path.join(template,'manifest.json'),'utf8'))
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error('心理委员原表模板校验失败')
 const zip=await JSZip.loadAsync(bytes),d=parse(await zip.file('xl/worksheets/sheet1.xml').async('string'))
 set(d,'A1','心理危机四级预警网络\n'+college)
 set(d,'A2','对接校心理专职教师：'+[headers.schoolTeacherName,headers.schoolTeacherContact].filter(Boolean).join(' '))
 set(d,'A3','学院心理工作负责人：'+[headers.collegeLeaderName,headers.collegeLeaderContact].filter(Boolean).join(' '))
 const body=d.getElementsByTagNameNS(NS,'sheetData')[0],sample=[...body.childNodes].find(n=>n.nodeType===1&&n.getAttribute('r')==='5').cloneNode(true)
 const widths=[...d.getElementsByTagNameNS(NS,'col')].filter(c=>Number(c.getAttribute('min'))<=6).map(c=>Number(c.getAttribute('width')))
 const units=s=>Array.from(String(s??'')).reduce((n,c)=>n+(/^[\x20-\x7e]$/.test(c)?0.55:1),0)
 // Keep original row heights for ordinary entries; expand only wrapped records.
 const baseHeight=Number(sample.getAttribute('ht')||d.getElementsByTagNameNS(NS,'sheetFormatPr')[0]?.getAttribute('defaultRowHeight')||15)
 for(const value of [college])if(units(value)>55)throw new HttpError(422,'COMMITTEE_EXPORT_OVERFLOW','学院名称超过原表标题容量，请精简学院名称后导出')
 for(const value of [[headers.schoolTeacherName,headers.schoolTeacherContact],[headers.collegeLeaderName,headers.collegeLeaderContact]])if(units(value.filter(Boolean).join(' '))>65)throw new HttpError(422,'COMMITTEE_EXPORT_OVERFLOW','负责人信息超过原表表头容量，请精简姓名或联系方式后导出')
 for(const row of [...body.childNodes])if(row.nodeType===1&&Number(row.getAttribute('r'))>=5)body.removeChild(row)
 for(const [i,r]of rows.entries()){
  const n=i+5,row=sample.cloneNode(true);row.setAttribute('r',n)
  const values=[r.campus,r.counselorName,r.className,r.name+(r.status==='former'?'（已离任）':''),r.gender,r.phone]
  const lines=Math.max(...values.map((value,j)=>Math.ceil(units(value)/Math.max(3,widths[j]/2))))
  if(lines>1){const height=Math.max(baseHeight,lines*12+3);if(height>409)throw new HttpError(422,'COMMITTEE_EXPORT_OVERFLOW','文字超过原表单行容量，请精简后导出；已保存内容完整保留');row.setAttribute('ht',height);row.setAttribute('customHeight','1')}
  for(const [j,c]of [...row.getElementsByTagNameNS(NS,'c')].entries()){c.setAttribute('r',String.fromCharCode(65+j)+n);textCell(d,c,values[j]??'')}
  body.appendChild(row)
 }
 const merges=d.getElementsByTagNameNS(NS,'mergeCells')[0]
 for(const node of [...merges.childNodes])if(node.nodeType===1&&!['A1:F1','A2:F2','A3:F3'].includes(node.getAttribute('ref')))merges.removeChild(node)
 for(const [column,key]of [['A',r=>r.campus],['B',r=>r.campus+'|'+r.counselorId],['C',r=>r.classId]])for(const [a,b]of groups(rows,key)){
  merge(d,merges,column+a+':'+column+b)
  for(let n=a+1;n<=b;n++)set(d,column+n,null)
 }
 merges.setAttribute('count',merges.getElementsByTagNameNS(NS,'mergeCell').length)
 const last=Math.max(5,rows.length+4);d.getElementsByTagNameNS(NS,'dimension')[0].setAttribute('ref','A1:F'+last)
 zip.file('xl/worksheets/sheet1.xml',xml(d))
 const workbook=parse(await zip.file('xl/workbook.xml').async('string'))
 let names=workbook.getElementsByTagNameNS(NS,'definedNames')[0]
 if(!names){names=workbook.createElementNS(NS,'definedNames');const calc=workbook.getElementsByTagNameNS(NS,'calcPr')[0];workbook.documentElement.insertBefore(names,calc||null)}
 for(const [name,value]of [['_xlnm.Print_Area',"'正面'!$A$1:$F$"+last],['_xlnm.Print_Titles',"'正面'!$1:$4"]]){
  for(const n of [...names.childNodes])if(n.nodeType===1&&n.getAttribute('name')===name&&n.getAttribute('localSheetId')==='0')names.removeChild(n)
  const node=workbook.createElementNS(NS,'definedName');node.setAttribute('name',name);node.setAttribute('localSheetId','0');node.appendChild(workbook.createTextNode(value));names.appendChild(node)
 }
 zip.file('xl/workbook.xml',xml(workbook))
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})
}
async function writeCommitteeExport(rows,headers,semesterName){
 // Separate source forms when counselors have different header contacts in one college.
 const groups=new Map();for(const row of rows){const own=row.exportHeaders||headers[row.college]||{},key=JSON.stringify([row.college,...['schoolTeacherName','schoolTeacherContact','collegeLeaderName','collegeLeaderContact'].map(k=>own[k]||'')]);if(!groups.has(key))groups.set(key,{college:row.college,headers:own,rows:[]});groups.get(key).rows.push(row)}
 if(groups.size===1){const g=[...groups.values()][0];return {buffer:await writeCommitteeWorkbook(g.college,g.rows,g.headers),mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',fileName:safeName(g.college+'-心理危机四级预警网络-'+semesterName)+'.xlsx'}}
 const zip=new JSZip();let n=0
 for(const g of groups.values()){const owners=[...new Set(g.rows.map(r=>r.counselorName))].join('、');zip.file(String(++n).padStart(2,'0')+'-'+safeName(g.college+'-'+owners)+'-心理危机四级预警网络.xlsx',await writeCommitteeWorkbook(g.college,g.rows,g.headers))}
 return {buffer:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),mimeType:'application/zip',fileName:safeName('心理委员名册-'+semesterName)+'.zip'}
}
module.exports={writeCommitteeWorkbook,writeCommitteeExport}
