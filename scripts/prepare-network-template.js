// Preserve the school's OOXML formatting while removing all sample personal data.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto')
const JSZip=require('../server/node_modules/jszip')
const {DOMParser,XMLSerializer}=require('../server/node_modules/@xmldom/xmldom')
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const parse=s=>new DOMParser().parseFromString(s,'application/xml')
const xml=d=>new XMLSerializer().serializeToString(d)
function setCell(d,c,value){for(const n of [...c.childNodes])if(['v','is','f'].includes(n.localName))c.removeChild(n);c.removeAttribute('t');if(value!=null){c.setAttribute('t','inlineStr');const is=d.createElementNS(ns,'is'),t=d.createElementNS(ns,'t');t.setAttribute('xml:space','preserve');t.appendChild(d.createTextNode(value));is.appendChild(t);c.appendChild(is)}}
async function main(){
 const source=process.argv[2];if(!source)throw new Error('Provide original school workbook path')
 const raw=await fs.readFile(source),zip=await JSZip.loadAsync(raw),out=path.resolve('server/templates/committee-network');await fs.mkdir(out,{recursive:true})
 const front={A1:'心理危机四级预警网络\n学院：',A2:'对接校心理专职教师：',A3:'学院心理工作负责人：',A4:'校区',B4:'辅导员',C4:'年级专业班级',D4:'心理委员',E4:'性别',F4:'联系方式'}
 const back={A1:'辅导员对接心理工作负责人',A2:'时间：',B2:'地点：',A3:'具体内容：',A4:'心理工作负责人签名：               日期：',A5:'班级心理委员对接辅导员',A6:'时间：',B6:'地点：',A7:'具体内容：',A10:'辅导员签名：             日期：',A12:'宿舍心理信息员对接班级心理委员',A13:'时间：',B13:'地点：',A14:'具体内容：',A15:'班级心理委员签名：               日期：'}
 for(const [i,safe]of [[1,front],[2,back]]){const key='xl/worksheets/sheet'+i+'.xml',d=parse(await zip.file(key).async('string'));for(const c of d.getElementsByTagNameNS(ns,'c'))setCell(d,c,safe[c.getAttribute('r')]??null);zip.file(key,xml(d))}
 zip.file('xl/sharedStrings.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${ns}" count="0" uniqueCount="0"/>`)
 zip.file('docProps/core.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>学校心理委员名册</dc:creator></cp:coreProperties>')
 const workbook=parse(await zip.file('xl/workbook.xml').async('string'));for(const n of [...workbook.getElementsByTagNameNS(ns,'definedName')])if(n.textContent==='#REF!')n.parentNode.removeChild(n);zip.file('xl/workbook.xml',xml(workbook))
 const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});await fs.writeFile(path.join(out,'blank.xlsx'),bytes)
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({source:path.basename(source),sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sheets:['正面','反面'],columns:6,headerRows:4,samplePersonalDataRemoved:true},null,2)+'\n')
 console.log('Saved sanitized school template; formatting retained, sample values removed.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
