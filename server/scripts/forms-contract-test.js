/* Fabricated acceptance data only; called by the guarded staff contract test. */
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const ExcelJS = require('exceljs')
const {PDFDocument} = require('pdf-lib')

async function verifyForms({admin, one, two, suffix, base, ok, request}) {
  const student = await ok('/registry/students', one, 'POST', {
    name:'虚构表格学生', college:'验收学院', gradeMajor:'2026级计算机1班',
    campus:'验收校区', major:'计算机', studentNo:'FORM'+suffix,
    levels:{'2026-10':'一级'}
  }, 201)
  const period = {semesterId:'2026-1', weekStart:'2026-10-19'}
  await ok('/weekly-ledgers/calendars/2026-1', admin, 'PATCH', {firstMonday:'2026-08-31'})
  const weekly = await ok('/weekly-ledgers/students/'+student.id, one, 'POST', {
    ...period, revision:0, status:'completed', campus:'验收校区', major:'计算机', psychologicalStatus:'虚构记录，持续联系。'
  })
  assert.equal(weekly.revision, 1)
  assert.equal((await request('/weekly-ledgers/students/'+student.id+'?'+new URLSearchParams(period), two)).status, 404)
  let book = new ExcelJS.Workbook()
  await book.xlsx.load(await ok('/weekly-ledgers/export', admin, 'POST', {...period, ids:[student.id]}, 200, true))
  assert.equal(book.worksheets[0].columnCount, 12)
  const cls = await ok('/committee/classes', one, 'POST', {
    semesterId:'2026-1', college:'验收学院', campus:'验收校区', name:'虚构验收班'+suffix
  }, 201)
  await ok('/committee/classes/'+cls.id+'/members', one, 'POST', {name:'虚构委员', gender:'女', phone:'001234'}, 201)
  await ok('/committee/college-headers', one, 'PATCH', {
    college:'验收学院', revision:0, schoolTeacherName:'虚构校老师', collegeLeaderName:'虚构院老师'
  })
  assert.equal((await request('/committee/classes/'+cls.id, two)).status, 404)
  const files = (await ok('/committee/export/options', admin, 'POST', {semesterId:'2026-1', classId:cls.id})).files
  assert.equal(files.length, 1)
  const selection = {semesterId:'2026-1', classId:cls.id, fileIds:[files[0].id], versions:{[files[0].id]:files[0].version}}
  const preview = await ok('/committee/export/preview', admin, 'POST', selection)
  assert.ok(preview.pageCount >= 2)
  assert.ok(preview.pages.every(p=>p.startsWith('data:image/png;base64,')))
  book = new ExcelJS.Workbook()
  await book.xlsx.load(await ok('/committee/export', admin, 'POST', selection, 200, true))
  assert.equal(book.worksheets.length, 2)
  assert.equal(book.worksheets[0].getCell('D5').text, '虚构委员')
  const application = await ok('/grade-applications', one, 'POST', {
    semesterId:'2026-1', clientRequestId:crypto.randomUUID(), status:'submitted',
    entries:[{registryStudentId:student.id, name:student.name, college:'验收学院', grade:'2026级', major:'计算机', entryDate:'2026-09-01', entryLevel:'一级', currentLevel:'一级', kind:'downgrade', targetLevel:'二级', reason:'虚构验收：申请心理中心复评。'}]
  }, 201)
  assert.equal((await request('/grade-applications/'+application.id, two)).status, 404)
  const gradePreview = await ok('/grade-applications/'+application.id+'/document?format=preview&revision=1', admin)
  assert.equal(gradePreview.pages.length, 1)
  assert.equal((await PDFDocument.load(Buffer.from(gradePreview.pdfBase64,'base64'))).getPageCount(), 1)
  const holiday = await ok('/holiday-periods', one, 'POST', {
    name:'虚构验收假期'+suffix, startDate:'2026-10-01', endDate:'2026-10-08', levelMonth:'2026-10'
  }, 201)
  // A valid 1x1 PNG avoids depending on host fixture paths inside the release image.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVYQAAAAASUVORK5CYII=','base64')
  const upload = await fetch(base+'/api/v1/holiday-departures/evidence', {method:'POST', headers:{authorization:'Bearer '+one,'content-type':'image/png'}, body:png})
  assert.equal(upload.status, 201)
  const evidence = (await upload.json()).data
  const departure = {...{holidayId:holiday.id, date:'2026-10-01', revision:0}, leaveSchool:'是', leaveDate:'2026-10-01', destination:'回家', parentReport:'虚构已确认', psychologicalStatus:'稳定', evidenceId:evidence.id}
  const saved = await ok('/holiday-departures/'+student.id, one, 'PUT', departure)
  assert.equal(saved.revision, 1)
  assert.equal((await request('/holiday-departures/evidence/'+evidence.id, two)).status, 404)
  assert.equal((await ok('/holiday-departures/'+student.id+'/versions?holidayId='+holiday.id+'&date=2026-10-01', admin)).length, 1)
  book = new ExcelJS.Workbook()
  await book.xlsx.load(await ok('/holiday-departures/export', admin, 'POST', {holidayId:holiday.id, from:'2026-10-01', to:'2026-10-01', ids:[student.id]}, 200, true))
  assert.equal(book.worksheets[0].columnCount, 22)
  assert.equal(book.worksheets[0].getImages().length, 1)
  assert.equal(book.worksheets[0].getColumn('N').hidden, true)
  for (const [url,method,body] of [
    ['/registry/students/'+student.id,'PATCH',student],
    ['/weekly-ledgers/students/'+student.id,'POST',{...period,revision:1,status:'draft'}],
    ['/committee/classes/'+cls.id,'PATCH',cls],
    ['/committee/college-headers','PATCH',{college:'验收学院',revision:1}],
    ['/grade-applications/'+application.id,'PATCH',application],
    ['/holiday-periods/'+holiday.id,'PATCH',holiday],
    ['/holiday-departures/'+student.id,'PUT',{...departure,revision:1}]
  ]) assert.equal((await request(url,admin,method,body)).status,403,url)
  assert.equal((await ok('/grade-applications/'+application.id,admin)).revision,1)
  assert.equal((await ok('/committee/classes/'+cls.id,admin)).revision,1)
  console.log('PASS: MySQL weekly, committee selection and real Excel preview, grade print preview, holiday screenshot export, owner isolation and administrator read-only')
}
module.exports={verifyForms}
