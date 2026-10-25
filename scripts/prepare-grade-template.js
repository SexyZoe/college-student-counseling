// Preserve the school's OOXML layout. Runtime generation fills cells without
// round-tripping the template through a spreadsheet engine (which rewrites styles).
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),JSZip=require('../server/node_modules/jszip')
;(async()=>{const source=process.argv[2];if(!source)throw new Error('Usage: node scripts/prepare-grade-template.js original.xlsx');const bytes=await fs.readFile(source),zip=await JSZip.loadAsync(bytes),dir=path.join(__dirname,'../server/templates/grade-application');await fs.mkdir(dir,{recursive:true})
 for(const name of ['docProps/core.xml','docProps/custom.xml'])zip.remove(name)
 let workbook=await zip.file('xl/workbook.xml').async('string');workbook=workbook.replace(/<mc:AlternateContent[\s\S]*?<\/mc:AlternateContent>/g,'').replace(/<extLst[\s\S]*?<\/extLst>/g,'').replace(/<x15ac:absPath[^>]*\/>/g,'');zip.file('xl/workbook.xml',workbook)
 let rel=await zip.file('_rels/.rels').async('string');rel=rel.replace(/<Relationship[^>]*Target="docProps\/(?:core|custom)\.xml"[^>]*\/>/g,'');zip.file('_rels/.rels',rel)
 let types=await zip.file('[Content_Types].xml').async('string');types=types.replace(/<Override[^>]*PartName="\/docProps\/(?:core|custom)\.xml"[^>]*\/>/g,'');zip.file('[Content_Types].xml',types)
 const blank=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});await fs.writeFile(path.join(dir,'blank.xlsx'),blank);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({sourceFile:path.basename(source),sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sha256:crypto.createHash('sha256').update(blank).digest('hex'),bodyRowsPerPage:3,notes:'原表列宽、行高、字体、颜色、边框和合并单元格保留。在线填写启用单元格自动换行；A4纵向适应一页宽，每三名学生重复原表分页。'},null,2)+'\n')
})().catch(e=>{console.error(e);process.exitCode=1})
