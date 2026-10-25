const fs=require('node:fs')
const fsp=require('node:fs/promises')
const os=require('node:os')
const path=require('node:path')
const {execFile}=require('node:child_process')
const {promisify}=require('node:util')
const JSZip=require('jszip')
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom')
const {PDFDocument,PDFName,PDFArray,decodePDFRawStream}=require('pdf-lib')
const {HttpError}=require('./errors')
const crypto=require('node:crypto')
const execute=promisify(execFile)
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const TEMPLATE=path.join(__dirname,'..','templates','talk-form')
const ISSUE_OPTIONS=['适应困难','人际交往','情感困扰','学业压力','情绪问题','家庭问题','躯体疾病','自我认知','其他']
const xmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
function width(text){return Array.from(text).reduce((n,c)=>n+(/^[\x20-\x7e]$/.test(c)?0.65:1),0)}
function wrapContent(text){const lines=[];for(const paragraph of String(text).split('\n')){let line='',units=0;for(const char of paragraph){const step=width(char);if(units+step>36){lines.push(line);line='';units=0}line+=char;units+=step}lines.push(line)}return lines}
function checkPrintable(r){const reasons=[];if(!r.name||!r.gender||!r.college||!r.gradeClass||!r.talkDate||!r.content)reasons.push('请补全姓名、性别、学院、年级专业班级、谈话日期和具体谈话内容');if(!r.issues?.length)reasons.push('请选择近期心理困扰类别');if(r.issues?.includes(9)&&!r.otherIssue)reasons.push('请补充“其他”困扰内容');if(wrapContent(r.content||'').length>5)reasons.push('谈话内容超过原表预留的5行容量，请精简后打印；已保存内容不会截断');return {ready:!reasons.length,reasons,lines:wrapContent(r.content||'').length}}
function direct(node,name){return Array.from(node.childNodes).filter(c=>c.nodeType===1&&c.namespaceURI===W&&c.localName===name)}
function writeRun(doc,run,text){for(const c of [...Array.from(run.childNodes)])if(c.nodeType===1&&c.localName!=='rPr')run.removeChild(c);const t=doc.createElementNS(W,'w:t');t.setAttribute('xml:space','preserve');t.appendChild(doc.createTextNode(text));run.appendChild(t)}
function writeParagraph(doc,p,text){let runs=direct(p,'r');if(!runs.length){const r=doc.createElementNS(W,'w:r');p.appendChild(r);runs=[r]}writeRun(doc,runs[0],text);runs.slice(1).forEach(r=>writeRun(doc,r,''))}
function fillIdentityCell(doc,cell,value){
 const paragraph=direct(cell,'p')[0]
 writeParagraph(doc,paragraph,value)
 const cellWidth=Number(direct(direct(cell,'tcPr')[0],'tcW')[0].getAttributeNS(W,'w'))
 // Keep the template's 10.5pt font and fixed cell width. Only a field that
 // needs wrapping uses a 12pt line box, allowing two complete lines within
 // the original 27pt first row instead of inheriting the oversized blank line.
 if(width(value)*10.5>(cellWidth-216)/20){
  const props=direct(paragraph,'pPr')[0]
  let spacing=direct(props,'spacing')[0]
  if(!spacing){spacing=doc.createElementNS(W,'w:spacing');props.appendChild(spacing)}
  spacing.setAttributeNS(W,'w:lineRule','exact')
  spacing.setAttributeNS(W,'w:line','240')
 }
}
async function fillTalkTemplate(record){
 const manifest=JSON.parse(await fsp.readFile(path.join(TEMPLATE,'manifest.json'),'utf8'))
 const original=await fsp.readFile(path.join(TEMPLATE,'template.docx'))
 if(crypto.createHash('sha256').update(original).digest('hex')!==manifest.docxSha256)throw new Error('谈话表模板与校验清单不一致')
 const zip=await JSZip.loadAsync(original),part=await zip.file('word/document.xml').async('string')
 const doc=new DOMParser().parseFromString(part,'application/xml')
 const table=doc.getElementsByTagNameNS(W,'tbl')[0],rows=direct(table,'tr'),cell=(r,c)=>direct(rows[r],'tc')[c]
 for(const [col,value] of [[1,record.name],[3,record.gender],[5,record.college]])fillIdentityCell(doc,cell(0,col),value)
 writeParagraph(doc,direct(cell(1,1),'p')[0],record.gradeClass)
 const selectedIssues=record.issues.map(id=>id+'. '+ISSUE_OPTIONS[id-1]+(id===9?'：'+record.otherIssue:''))
 const issueParagraph=direct(cell(2,0),'p')[0]
 writeParagraph(doc,issueParagraph,'近期心理困扰：'+selectedIssues.join('；'))
 // Remove the original option runs, including the underlined blank for “其他”.
 direct(issueParagraph,'r').slice(1).forEach(run=>issueParagraph.removeChild(run))
 const paragraphs=direct(cell(3,0),'p'),lines=wrapContent(record.content)
 if(lines.length>5)throw new HttpError(422,'TALK_PRINT_OVERFLOW','具体谈话内容超出原表容量，请精简后再导出')
 for(let i=1;i<paragraphs.length;i++)writeParagraph(doc,paragraphs[i],lines[i-1]||'')
 const signatureRuns=direct(direct(cell(4,0),'p')[0],'r'),last=signatureRuns[signatureRuns.length-1]
 // Leave both signature slots unchanged, fill only the original date location.
 writeRun(doc,last,last.textContent+record.talkDate)
 zip.file('word/document.xml',new XMLSerializer().serializeToString(doc))
 return Buffer.from(await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}))
}
async function pdfGeometry(buffer){const doc=await PDFDocument.load(buffer);if(doc.getPageCount()!==1)return {pages:doc.getPageCount(),lines:[]};const page=doc.getPage(0),contents=page.node.lookup(PDFName.of('Contents'));const streams=contents instanceof PDFArray?contents.asArray().map(r=>doc.context.lookup(r)):[contents];const operators=streams.map(s=>Buffer.from(decodePDFRawStream(s).decode()).toString('latin1')).join('\n').replace(/BT[\s\S]*?ET/g,'');const numeric='(-?\\d+(?:\\.\\d+)?)';const regex=new RegExp(numeric+'\\s+'+numeric+'\\s+m\\s+'+numeric+'\\s+'+numeric+'\\s+l\\s+S','g');const lines=[...operators.matchAll(regex)].map(m=>m.slice(1).map(Number)).filter(([a,b,c,d])=>Math.abs(a-c)<0.01||Math.abs(a-c)>300).sort((a,b)=>a.join(',').localeCompare(b.join(',')));return {pages:1,size:page.getSize(),lines}}
function matchingGeometry(a,b){return a.pages===1&&b.pages===1&&Math.abs(a.size.width-b.size.width)<0.1&&Math.abs(a.size.height-b.size.height)<0.1&&a.lines.length>=10&&a.lines.length===b.lines.length&&a.lines.every((line,i)=>line.every((n,j)=>Math.abs(n-b.lines[i][j])<0.06))}
function overflowMessage(reference,generated,record){
 const horizontal=g=>g.lines.filter(([x,y,x2,y2])=>Math.abs(x2-x)>300&&Math.abs(y-y2)<0.01).map(l=>l[1]).sort((a,b)=>b-a)
 const old=horizontal(reference),next=horizontal(generated)
 const index=old.findIndex((y,i)=>next[i]===undefined||Math.abs(y-next[i])>=0.06)
 let field='填写内容'
 if(index===1){
  const fields=[['姓名',record.name,52],['性别',record.gender,54],['学院',record.college,72]].filter(([,v,w])=>width(v)*10.5>w)
  field=fields.length?fields.map(f=>f[0]+'栏').join('、'):'姓名、性别或学院栏'
 }else if(index===2)field='年级专业班级栏'
 else if(index===3)field='近期心理困扰栏'
 else if(index===4)field='具体谈话内容栏'
 else if(index===5)field='日期栏'
 return field+'超出学校原表的固定空间，导致换行撑高表格'+(generated.pages!==1?'或产生额外页面':'')+'。请检查该栏内容；记录已完整保存，未被截断。'
}
function converterPath(config){if(config.documentConverterPath)return config.documentConverterPath;const bundled=path.resolve(path.dirname(process.execPath),'../../bin/override/soffice');if(fs.existsSync(bundled))return bundled;return process.platform==='win32'?'soffice.exe':'soffice'}
function createTalkDocumentRenderer(config={}){
 let tail=Promise.resolve(),queued=0,baseline
 const binary=converterPath(config)
 async function convert(file,type,dir,profile,fontConfig){
  try{await execute(binary,['-env:UserInstallation='+new URL('file://'+profile).href,'--headless','--convert-to',type,'--outdir',dir,file],{timeout:30000,maxBuffer:256*1024,env:{...process.env,FONTCONFIG_FILE:fontConfig}})}catch(error){throw new HttpError(503,'TALK_CONVERTER_UNAVAILABLE','Word/PDF转换服务不可用或超时，请联系管理员检查文档转换配置')}
  const ext=type.split(':')[0],output=path.join(dir,path.basename(file,path.extname(file))+'.'+ext)
  try{return await fsp.readFile(output)}catch(_){throw new HttpError(503,'TALK_CONVERSION_FAILED','未生成谈话表文件，请联系管理员检查文档转换器')}
 }
 async function renderOne(record,format){
  const check=checkPrintable(record);if(!check.ready)throw new HttpError(422,'TALK_PRINT_INCOMPLETE',check.reasons.join('；'))
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'school-talk-'))
  try{
   await fsp.chmod(directory,0o700)
   const fonts=path.join(directory,'fonts.conf'),profile=path.join(directory,'profile')
   const dirs=process.platform==='darwin'?['/System/Library/Fonts','/System/Library/Fonts/Supplemental','/Library/Fonts',path.join(os.homedir(),'Library/Fonts')]:['/usr/share/fonts','/usr/local/share/fonts',path.join(os.homedir(),'.fonts')]
   await fsp.writeFile(fonts,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig>${dirs.map(d=>'<dir>'+xmlEscape(d)+'</dir>').join('')}<cachedir>${xmlEscape(path.join(directory,'font-cache'))}</cachedir><alias><family>宋体</family><prefer><family>SimSun</family><family>Songti SC</family><family>Noto Serif CJK SC</family></prefer></alias><alias><family>黑体</family><prefer><family>SimHei</family><family>Heiti SC</family><family>Hiragino Sans GB</family><family>Noto Sans CJK SC</family></prefer></alias></fontconfig>`,{mode:0o600})
   // Cache only the empty template's geometry, never student documents.
   if(!baseline){const ref=path.join(directory,'original.doc');await fsp.copyFile(path.join(TEMPLATE,'original.doc'),ref);baseline=await pdfGeometry(await convert(ref,'pdf',directory,profile,fonts))}
   const docx=await fillTalkTemplate(record),input=path.join(directory,'talk-form.docx');await fsp.writeFile(input,docx,{mode:0o600})
   const pdf=await convert(input,'pdf',directory,profile,fonts)
   const geometry=await pdfGeometry(pdf)
   if(!matchingGeometry(baseline,geometry))throw new HttpError(422,'TALK_PRINT_OVERFLOW',overflowMessage(baseline,geometry,record))
   if(format==='pdf')return {buffer:pdf,mimeType:'application/pdf'}
   if(format==='docx')return {buffer:docx,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
   const doc=await convert(input,'doc:MS Word 97',directory,profile,fonts),docFile=path.join(directory,'word-output','talk-form.doc')
   await fsp.mkdir(path.dirname(docFile));await fsp.writeFile(docFile,doc,{mode:0o600})
   const roundtrip=await convert(docFile,'pdf',path.dirname(docFile),profile,fonts)
   if(!matchingGeometry(baseline,await pdfGeometry(roundtrip)))throw new HttpError(422,'TALK_PRINT_OVERFLOW','Word转换后的排版与原表不一致，请调整内容后重试')
   return {buffer:doc,mimeType:'application/msword'}
  }finally{await fsp.rm(directory,{recursive:true,force:true})}
 }
 async function render(record,format){if(queued>=6)throw new HttpError(429,'TALK_CONVERTER_BUSY','当前生成请求较多，请稍后再试');queued++;const preceding=tail;let release;tail=new Promise(r=>{release=r});await preceding;try{return await renderOne(record,format)}finally{queued--;release()}}
 return {render,capabilities:()=>({fontFidelity:config.documentFontsExact===true?'original-fonts':'compatible-fonts',fontNotice:config.documentFontsExact===true?'已配置学校原表字体':'Word保留原表字体定义；当前PDF预览使用兼容中文字体，完全一致打印需安装宋体、黑体。',formats:['doc','docx','pdf'],contentLines:5})}
}
module.exports={createTalkDocumentRenderer,fillTalkTemplate,pdfGeometry,matchingGeometry,checkPrintable,ISSUE_OPTIONS,wrapContent}
