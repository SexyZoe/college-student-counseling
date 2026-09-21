const crypto = require("node:crypto")
const { HttpError } = require("./errors")
const { createPasswordRecordAsync, normalizeAccountId } = require("./security")

const HEADER_ALIASES = {
  type: ["类型", "type", "recordtype"],
  accountId: ["账号", "accountid", "account", "学号", "工号"],
  name: ["姓名", "name"],
  classId: ["班级编号", "classid"],
  className: ["班级名称", "classname"],
  major: ["专业", "major"],
  semesterId: ["学期编号", "semesterid"],
  password: ["初始密码", "password"]
}

const TYPE_ALIASES = {
  "班级": "class", "class": "class",
  "学生": "student", "student": "student",
  "辅导员": "counselor", "counselor": "counselor",
  "分配": "assignment", "assignment": "assignment"
}

function parseCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "")
  if (!source.trim()) throw new HttpError(422, "IMPORT_EMPTY", "CSV 文件不能为空")
  const rows = []
  let row = []
  let field = ""
  let quoted = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++ }
      else if (char === '"') quoted = false
      else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ",") { row.push(field); field = "" }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (char !== "\r") field += char
  }
  if (quoted) throw new HttpError(422, "IMPORT_CSV_INVALID", "CSV 引号未正确闭合")
  row.push(field)
  if (row.some(function(value) { return value !== "" })) rows.push(row)
  return rows.filter(function(values) { return values.some(function(value) { return String(value).trim() !== "" }) })
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]/g, "")
}

function headerMap(headers) {
  const map = {}
  Object.keys(HEADER_ALIASES).forEach(function(field) {
    const aliases = HEADER_ALIASES[field]
    const index = headers.findIndex(function(header) { return aliases.indexOf(normalizeHeader(header)) !== -1 })
    if (index >= 0) map[field] = index
  })
  ;["type", "accountId", "name", "classId", "className", "major", "semesterId", "password"].forEach(function(field) {
    if (map[field] === undefined) throw new HttpError(422, "IMPORT_HEADER_INVALID", "CSV 缺少字段：" + HEADER_ALIASES[field][0])
  })
  return map
}

function cell(values, map, field) {
  return String(values[map[field]] || "").trim()
}

function normalizeRows(csvText) {
  const rows = parseCsv(csvText)
  if (rows.length < 2) throw new HttpError(422, "IMPORT_EMPTY", "CSV 中没有可导入的数据")
  if (rows.length - 1 > 500) throw new HttpError(413, "IMPORT_TOO_MANY_ROWS", "单次最多导入 500 行")
  const map = headerMap(rows[0])
  return rows.slice(1).map(function(values, index) {
    const rawType = cell(values, map, "type").toLowerCase()
    const type = TYPE_ALIASES[rawType] || ""
    return {
      rowNumber: index + 2,
      type: type,
      rawType: cell(values, map, "type"),
      accountId: normalizeAccountId(cell(values, map, "accountId")),
      name: cell(values, map, "name"),
      classId: cell(values, map, "classId").toUpperCase(),
      className: cell(values, map, "className"),
      major: cell(values, map, "major"),
      semesterId: cell(values, map, "semesterId"),
      password: cell(values, map, "password")
    }
  })
}

function validateFormat(row) {
  const errors = []
  const add = function(field, message) { errors.push({ rowNumber:row.rowNumber, field:field, message:message }) }
  if (!row.type) add("类型", "仅支持班级、学生、辅导员或分配")
  if (row.type === "class") {
    if (!/^[A-Z0-9_-]{2,32}$/.test(row.classId)) add("班级编号", "需为 2–32 位字母、数字、下划线或短横线")
    if (!row.className || row.className.length > 50) add("班级名称", "不能为空且最多 50 个字符")
  }
  if (row.type === "student" || row.type === "counselor") {
    if (!/^[a-z0-9_-]{3,32}$/.test(row.accountId)) add("账号", "需为 3–32 位字母、数字、下划线或短横线")
    if (!row.roster && (!row.name || row.name.length > 50)) add("姓名", "不能为空且最多 50 个字符")
    if (row.type === "student" && !/^[A-Z0-9_-]{2,32}$/.test(row.classId)) add("班级编号", "学生必须填写有效班级编号")
    if (!row.roster && row.type === "student" && row.password && (row.password.length < 8 || row.password.length > 64)) add("初始密码", "填写时必须为 8–64 个字符")
    if (row.roster && !/^[a-z0-9_-]{4,32}$/.test(row.accountId)) add("学号", "需为 4–32 位字母、数字、下划线或短横线，以便生成后4位初始密码")
  }
  if (row.type === "assignment") {
    if (!/^[a-z0-9_-]{3,32}$/.test(row.accountId)) add("账号", "分配行账号必须填写辅导员工号")
    if (!/^[A-Z0-9_-]{2,32}$/.test(row.classId)) add("班级编号", "分配行必须填写班级编号")
    if (!row.semesterId || row.semesterId.length > 50) add("学期编号", "分配行必须填写学期编号")
  }
  return errors
}

async function passwordRecord(row) {
  if (!row.password) return null
  return createPasswordRecordAsync(row.password)
}

function fileHash(csvText) {
  return crypto.createHash("sha256").update(String(csvText || "")).digest("hex")
}

function safeRow(row) {
  return {
    rowNumber: row.rowNumber,
    type: row.type,
    accountId: row.accountId,
    name: row.name,
    classId: row.classId,
    className: row.className,
    major: row.major,
    semesterId: row.semesterId
  }
}

module.exports = { parseCsv, normalizeRows, validateFormat, passwordRecord, fileHash, safeRow }
