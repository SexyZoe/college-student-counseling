const crypto = require("node:crypto")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { DatabaseSync } = require("node:sqlite")
const { encryptFile } = require("../src/backup-format")

function required(name) {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error("缺少环境变量 " + name)
  return value
}

function sqlString(value) {
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

async function main() {
  const databasePath = path.resolve(required("DATABASE_PATH"))
  const backupDirectory = path.resolve(required("BACKUP_DIRECTORY"))
  const encryptionKey = required("BACKUP_ENCRYPTION_KEY")
  const keyId = process.env.BACKUP_ENCRYPTION_KEY_ID || "backup-primary"
  if (!fs.existsSync(databasePath)) throw new Error("数据库文件不存在：" + databasePath)
  fs.mkdirSync(backupDirectory, { recursive:true, mode:0o700 })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const baseName = "shuzhi-sqlite-" + timestamp + "-" + crypto.randomBytes(4).toString("hex")
  const temporary = path.join(os.tmpdir(), baseName + ".db")
  const destination = path.join(backupDirectory, baseName + ".db.enc")
  const database = new DatabaseSync(databasePath, { readOnly:true })
  try {
    const check = database.prepare("PRAGMA quick_check").all()
    if (check.length !== 1 || check[0].quick_check !== "ok") throw new Error("源数据库完整性检查失败")
    database.exec("VACUUM INTO " + sqlString(temporary))
  } finally {
    database.close()
  }
  try {
    await encryptFile(temporary, destination, encryptionKey, keyId)
    const manifest = {
      version:1,
      createdAt:new Date().toISOString(),
      source:path.basename(databasePath),
      backup:path.basename(destination),
      bytes:fs.statSync(destination).size,
      sha256:sha256(destination),
      keyId:keyId
    }
    fs.writeFileSync(destination + ".manifest.json", JSON.stringify(manifest, null, 2) + "\n", { flag:"wx", mode:0o600 })
    console.log(JSON.stringify(manifest))
  } finally {
    fs.rmSync(temporary, { force:true })
  }
}

main().catch(function(error) {
  console.error("SQLite备份失败：" + error.message)
  process.exit(1)
})
