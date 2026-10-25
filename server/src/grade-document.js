const fs=require('node:fs/promises'),syncfs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util')
const JSZip=require('jszip'),{DOMParser,XMLSerializer}=require('@xmldom/xmldom'),{PDFDocument}=require('pdf-lib'),{HttpError}=require('./errors')
const execute=promisify(execFile),NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',TEMPLATE=path.join(__dirname,'../templates/grade-application')
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const widths=[4.25,9.6416666667,9.6416666667,9.6416666667,9.6416666667,11.6,9.6416666667,9.6416666667,10.875,8.75,38.5],heights=[69,56,49]
const textUnits=s=>Array.from(s).reduce((n,c)=>n+(/[\x20-\x7e]/.test(c)?0.55:1),0)
function values(e,i){return [i+1,e.name,e.college,e.grade,e.major,e.entryDate,e.entryLevel,e.currentLevel,e.kind==='exit'?'出库':e.kind==='downgrade'?'降级至'+e.targetLevel:'',e.remarks,e.reason]}
function wrappedLines(s,width){return String(s).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(textUnits(line)/width)),0)}
function checkGradePrintable(record){const reasons=[];if(!record.entries?.length)reasons.push('请至少填写一名学生')
 for(const [i,e]of (record.entries||[]).entries()){
  if(['name','college','grade','major','entryDate','entryLevel','currentLevel','kind','reason'].some(k=>!e[k])||(e.kind==='downgrade'&&!e.targetLevel))reasons.push('第 '+(i+1)+' 名学生的信息尚未填全')
  const capacity=Math.floor((heights[i%3]-7)/13.2)
  values(e,i).forEach((v,c)=>{if(c===0||c===5)return;if(wrappedLines(v,Math.max(1,Math.floor((widths[c]*7-7)*0.75/11)))>capacity)reasons.push('第 '+(i+1)+' 名学生的“'+['序号','姓名','学院','年级','专业','进库日期','进库等级','现等级','降级/出库','备注','等级变动理由'][c]+'”超出原表固定空间，请精简后打印')})
 }
 if(record.centerOpinion&&wrappedLines('心理中心评估后意见：'+record.centerOpinion,70)>3)reasons.push('心理中心意见超出原表固定空间，请精简后打印')
 return {ready:reasons.length===0,reasons}
}
async function fillGradeWorkbook(record,{blank=false}={}){
 const bytes=await fs.readFile(path.join(TEMPLATE,'blank.xlsx')),manifest=JSON.parse(await fs.readFile(path.join(TEMPLATE,'manifest.json'),'utf8'));if(crypto.createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error('降级出库学校模板校验失败')
 const zip=await JSZip.loadAsync(bytes),parser=new DOMParser(),serialize=d=>new XMLSerializer().serializeToString(d),doc=parser.parseFromString(await zip.file('xl/worksheets/sheet1.xml').async('string'),'application/xml'),styles=parser.parseFromString(await zip.file('xl/styles.xml').async('string'),'application/xml')
 const nodes=(d,t)=>Array.from(d.getElementsByTagNameNS(NS,t)),data=nodes(doc,'sheetData')[0],source=nodes(data,'row').map(r=>r.cloneNode(true)),xfs=nodes(styles,'cellXfs')[0],baseStyles=Array.from(xfs.childNodes).filter(n=>n.nodeType===1),wrapStyles=new Map()
 // The supplied merged title has only a right border on K1. Write its whole
 // perimeter explicitly so each printed form has the requested closed frame.
 const borders=nodes(styles,'borders')[0],originalBorders=Array.from(borders.childNodes).filter(n=>n.nodeType===1),titleStyles=new Map()
 for(const [position,sides]of [['left',['left','top','bottom']],['middle',['top','bottom']],['right',['right','top','bottom']]]){
  const border=originalBorders[0].cloneNode(true)
  for(const side of sides){const previous=nodes(border,side)[0],edge=nodes(originalBorders[2],side)[0].cloneNode(true);border.replaceChild(edge,previous)}
  const borderId=Array.from(borders.childNodes).filter(n=>n.nodeType===1).length;borders.appendChild(border)
  const style=baseStyles[position==='right'?2:1].cloneNode(true);style.setAttribute('borderId',borderId);style.setAttribute('applyBorder','1');titleStyles.set(position,Array.from(xfs.childNodes).filter(n=>n.nodeType===1).length);xfs.appendChild(style)
 }
 borders.setAttribute('count',Array.from(borders.childNodes).filter(n=>n.nodeType===1).length)
 // Append wrapped variants. Original style definitions, including red entry
 // fonts, remain unchanged; no row grows and no font is reduced to fit.
 for(const r of source.slice(2,5))for(const c of nodes(r,'c')){const index=Number(c.getAttribute('s')||0);if(wrapStyles.has(index))continue;const style=baseStyles[index].cloneNode(true);let align=nodes(style,'alignment')[0];if(!align){align=styles.createElementNS(NS,'alignment');style.appendChild(align)}align.setAttribute('wrapText','1');wrapStyles.set(index,Array.from(xfs.childNodes).filter(n=>n.nodeType===1).length);xfs.appendChild(style)}
 xfs.setAttribute('count',Array.from(xfs.childNodes).filter(n=>n.nodeType===1).length)
 const pages=Math.max(1,Math.ceil(record.entries.length/3));while(data.firstChild)data.removeChild(data.firstChild)
 const merges=nodes(doc,'mergeCells')[0];while(merges.firstChild)merges.removeChild(merges.firstChild)
 function set(c,v){while(c.firstChild)c.removeChild(c.firstChild);c.setAttribute('t','inlineStr');const is=doc.createElementNS(NS,'is'),t=doc.createElementNS(NS,'t');t.setAttribute('xml:space','preserve');t.appendChild(doc.createTextNode(String(v??'')));is.appendChild(t);c.appendChild(is)}
 for(let p=0;p<pages;p++){
  for(let j=0;j<7;j++){const row=source[j].cloneNode(true),number=p*7+j+1;row.setAttribute('r',number);const cells=nodes(row,'c');for(let col=0;col<cells.length;col++){const c=cells[col];c.setAttribute('r',String.fromCharCode(65+col)+number)
    if(j===0)c.setAttribute('s',titleStyles.get(col===0?'left':col===10?'right':'middle'))
    if(j>=2&&j<=4){const e=record.entries[p*3+j-2],vals=e&&!blank?values(e,p*3+j-2):[];set(c,vals[col]??'');c.setAttribute('s',wrapStyles.get(Number(c.getAttribute('s'))))}
    if(j===5&&col===0&&!blank&&record.signatureDate){const [y,m,d]=record.signatureDate.split('-');set(c,'学管工作负责人签字：            学院（盖章）                 日期：'+y+'年'+m+'月'+d+'日')}
    if(j===6&&col===0)set(c,'心理中心评估后意见：'+(!blank?(record.centerOpinion||''):''))
   }data.appendChild(row)}
  for(const [start,end]of [[1,1],[6,6],[7,7]]){const m=doc.createElementNS(NS,'mergeCell');m.setAttribute('ref','A'+(p*7+start)+':K'+(p*7+end));merges.appendChild(m)}
 }
 merges.setAttribute('count',pages*3);nodes(doc,'dimension')[0].setAttribute('ref','A1:K'+pages*7)
 let props=nodes(doc,'sheetPr')[0];if(!props){props=doc.createElementNS(NS,'sheetPr');doc.documentElement.insertBefore(props,doc.documentElement.firstChild)}let fit=nodes(props,'pageSetUpPr')[0];if(!fit){fit=doc.createElementNS(NS,'pageSetUpPr');props.appendChild(fit)}fit.setAttribute('fitToPage','1')
 const setup=nodes(doc,'pageSetup')[0];setup.setAttribute('fitToWidth','1');setup.setAttribute('fitToHeight','0')
 const breaks=doc.createElementNS(NS,'rowBreaks');breaks.setAttribute('count',pages-1);breaks.setAttribute('manualBreakCount',pages-1);for(let p=1;p<pages;p++){const b=doc.createElementNS(NS,'brk');for(const [k,v]of Object.entries({id:p*7,min:0,max:16383,man:1}))b.setAttribute(k,v);breaks.appendChild(b)}if(pages>1)doc.documentElement.appendChild(breaks)
 // The merged opinion cell uses the original fixed 63-point row, with wrapping.
 const opinionBase=baseStyles[16].cloneNode(true),opinionAlign=nodes(opinionBase,'alignment')[0];opinionAlign.setAttribute('wrapText','1');const opinionStyle=Array.from(xfs.childNodes).filter(n=>n.nodeType===1).length;xfs.appendChild(opinionBase);xfs.setAttribute('count',opinionStyle+1);for(let p=0;p<pages;p++)nodes(data,'c').find(c=>c.getAttribute('r')==='A'+(p*7+7)).setAttribute('s',opinionStyle)
 const workbook=parser.parseFromString(await zip.file('xl/workbook.xml').async('string'),'application/xml');let names=nodes(workbook,'definedNames')[0];if(!names){names=workbook.createElementNS(NS,'definedNames');const calc=nodes(workbook,'calcPr')[0];workbook.documentElement.insertBefore(names,calc||null)}for(const n of nodes(names,'definedName'))if(n.getAttribute('name')==='_xlnm.Print_Area')names.removeChild(n);const area=workbook.createElementNS(NS,'definedName');area.setAttribute('name','_xlnm.Print_Area');area.setAttribute('localSheetId','0');area.appendChild(workbook.createTextNode("'Sheet1'!$A$1:$K$"+pages*7));names.appendChild(area)
 zip.file('xl/worksheets/sheet1.xml',serialize(doc));zip.file('xl/styles.xml',serialize(styles));zip.file('xl/workbook.xml',serialize(workbook));return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})
}
function createGradeDocumentRenderer(config={}){
 let tail=Promise.resolve(),queued=0
 async function renderOne(record,format){const check=checkGradePrintable(record);if(!check.ready)throw new HttpError(422,'APPLICATION_PRINT_OVERFLOW',check.reasons.join('；')+'。保存的数据完整保留，不会截断。')
  const workbook=await fillGradeWorkbook(record)
  if(format==='xlsx')return {buffer:workbook,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'grade-form-'));try{
   await fs.chmod(dir,0o700);const fonts=path.join(dir,'fonts.conf'),profile=path.join(dir,'profile'),file=path.join(dir,'application.xlsx')
   const dirs=process.platform==='darwin'?['/System/Library/Fonts','/System/Library/Fonts/Supplemental','/Library/Fonts',path.join(os.homedir(),'Library/Fonts')]:['/usr/share/fonts','/usr/local/share/fonts',path.join(os.homedir(),'.fonts')]
   await fs.writeFile(fonts,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig>${dirs.map(d=>'<dir>'+xml(d)+'</dir>').join('')}<cachedir>${xml(path.join(dir,'cache'))}</cachedir><alias><family>宋体</family><prefer><family>SimSun</family><family>Songti SC</family><family>Noto Serif CJK SC</family></prefer></alias></fontconfig>`);await fs.writeFile(file,workbook,{mode:0o600})
   const bundled=path.resolve(path.dirname(process.execPath),'../../bin/override/soffice'),binary=config.documentConverterPath||(syncfs.existsSync(bundled)?bundled:'soffice')
   try{await execute(binary,['-env:UserInstallation='+new URL('file://'+profile).href,'--headless','--convert-to','pdf','--outdir',dir,file],{timeout:30000,maxBuffer:256*1024,env:{...process.env,FONTCONFIG_FILE:fonts}})}catch(e){throw new HttpError(503,'APPLICATION_CONVERTER','原表 PDF 转换服务不可用或超时，请检查文档转换器配置')}
   let pdf;try{pdf=await fs.readFile(path.join(dir,'application.pdf'))}catch(e){throw new HttpError(503,'APPLICATION_CONVERTER','原表 PDF 未生成，请检查文档转换配置')}
   const doc=await PDFDocument.load(pdf),expected=Math.max(1,Math.ceil(record.entries.length/3));if(doc.getPageCount()!==expected||doc.getPages().some(p=>Math.abs(p.getWidth()-595.3)>2||Math.abs(p.getHeight()-841.9)>2))throw new HttpError(422,'APPLICATION_PAGINATION','原表分页检查未通过，请联系管理员检查打印配置；记录已完整保存')
   if(format==='preview'){
    const bundledRasterizer=path.resolve(path.dirname(process.execPath),'../../bin/override/pdftoppm'),rasterizer=config.documentRasterizerPath||(syncfs.existsSync(bundledRasterizer)?bundledRasterizer:'pdftoppm')
    try{await execute(rasterizer,['-r','300','-png',path.join(dir,'application.pdf'),path.join(dir,'page')],{timeout:30000,maxBuffer:256*1024})}catch(e){throw new HttpError(503,'APPLICATION_PREVIEW','打印预览服务暂不可用，请下载 PDF 查看并打印')}
    const files=(await fs.readdir(dir)).filter(f=>/^page-\d+\.png$/.test(f)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]))
    if(files.length!==expected)throw new HttpError(503,'APPLICATION_PREVIEW','预览页面未完整生成，请下载 PDF 打印')
    const pages=[];for(const f of files)pages.push('data:image/png;base64,'+(await fs.readFile(path.join(dir,f))).toString('base64'))
    return {pages,pdfBase64:pdf.toString('base64')}
   }
   return {buffer:pdf,mimeType:'application/pdf'}
  }finally{await fs.rm(dir,{recursive:true,force:true})}
 }
 async function render(record,format){if(queued>=6)throw new HttpError(429,'APPLICATION_BUSY','生成请求较多，请稍后重试');queued++;const previous=tail;let release;tail=new Promise(r=>{release=r});await previous;try{return await renderOne(record,format)}finally{queued--;release()}}
 return {render}
}
module.exports={fillGradeWorkbook,checkGradePrintable,createGradeDocumentRenderer}
