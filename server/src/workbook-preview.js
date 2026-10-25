const fs=require('node:fs/promises'),syncfs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),{PDFDocument}=require('pdf-lib'),{HttpError}=require('./errors')
const execute=promisify(execFile),escapeXml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
function binary(config,key,name){const bundled=path.resolve(path.dirname(process.execPath),'../../bin/override/'+name);return config[key]||(syncfs.existsSync(bundled)?bundled:name)}
function createWorkbookPreviewRenderer(config={}){
 let tail=Promise.resolve(),queued=0
 async function convert(buffer){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'committee-preview-'))
  try{
   await fs.chmod(dir,0o700)
   const input=path.join(dir,'school-form.xlsx'),fonts=path.join(dir,'fonts.conf'),profile=path.join(dir,'profile')
   const dirs=process.platform==='darwin'?['/System/Library/Fonts','/System/Library/Fonts/Supplemental','/Library/Fonts',path.join(os.homedir(),'Library/Fonts')]:['/usr/share/fonts','/usr/local/share/fonts',path.join(os.homedir(),'.fonts')]
   await fs.writeFile(fonts,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig>${dirs.map(d=>'<dir>'+escapeXml(d)+'</dir>').join('')}<cachedir>${escapeXml(path.join(dir,'cache'))}</cachedir><alias><family>宋体</family><prefer><family>SimSun</family><family>Songti SC</family><family>Noto Serif CJK SC</family></prefer></alias><alias><family>黑体</family><prefer><family>SimHei</family><family>Heiti SC</family><family>Noto Sans CJK SC</family></prefer></alias></fontconfig>`,{mode:0o600})
   await fs.writeFile(input,buffer,{mode:0o600})
   try{await execute(binary(config,'documentConverterPath','soffice'),['-env:UserInstallation='+pathToFileURL(profile).href,'--headless','--convert-to','pdf','--outdir',dir,input],{timeout:30000,maxBuffer:256*1024,env:{...process.env,FONTCONFIG_FILE:fonts}})}catch(e){throw new HttpError(503,'COMMITTEE_PREVIEW_UNAVAILABLE','原表预览服务暂不可用，请重试；仍可下载 Excel 查看')}
   const pdfPath=path.join(dir,'school-form.pdf');let pdf
   try{pdf=await fs.readFile(pdfPath)}catch(e){throw new HttpError(503,'COMMITTEE_PREVIEW_UNAVAILABLE','未能生成原表预览，仍可下载 Excel 查看')}
   const document=await PDFDocument.load(pdf),count=document.getPageCount()
   if(count>30)throw new HttpError(422,'COMMITTEE_PREVIEW_LIMIT','此文件超过 30 页，请缩小班级范围后预览，或直接下载完整 Excel')
   try{await execute(binary(config,'documentRasterizerPath','pdftoppm'),['-r','200','-png',pdfPath,path.join(dir,'page')],{timeout:30000,maxBuffer:256*1024})}catch(e){throw new HttpError(503,'COMMITTEE_PREVIEW_UNAVAILABLE','原表预览图片暂不可用，仍可下载 Excel 查看')}
   const files=(await fs.readdir(dir)).filter(f=>/^page-\d+\.png$/.test(f)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]))
   if(files.length!==count)throw new HttpError(503,'COMMITTEE_PREVIEW_INCOMPLETE','原表预览未完整生成，请重试或下载 Excel 查看')
   const pages=[];for(const file of files)pages.push('data:image/png;base64,'+(await fs.readFile(path.join(dir,file))).toString('base64'))
   return {pages,pageCount:count,fontNotice:config.documentFontsExact===true?'':'预览使用兼容中文字体；Excel 保留学校原表的字体定义。'}
  }finally{await fs.rm(dir,{recursive:true,force:true})}
 }
 async function render(buffer){if(queued>=3)throw new HttpError(429,'COMMITTEE_PREVIEW_BUSY','正在生成其他预览，请稍后重试');queued++;const previous=tail;let release;tail=new Promise(r=>release=r);await previous;try{return await convert(buffer)}finally{queued--;release()}}
 return {render}
}
module.exports={createWorkbookPreviewRenderer}
