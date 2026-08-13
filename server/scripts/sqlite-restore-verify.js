const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { DatabaseSync } = require("node:sqlite")
const { decryptFile } = require("../src/backup-format")

function required(name) {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error("缺少环境变量 " + name)
  return value
}

async function main() {
  const backupPath = path.resolve(required("BACKUP_FILE"))
  const key = required("BACKUP_ENCRYPTION_KEY")
  const keyId = process.env.BACKUP_ENCRYPTION_KEY_ID || "backup-primary"
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shuzhi-restore-"))
  const restoredPath = path.join(temporaryDirectory, "restored.db")
  try {
    await decryptFile(backupPath, restoredPath, key, keyId)
    const database = new DatabaseSync(restoredPath, { readOnly:true })
    let summary
    try {
      const check = database.prepare("PRAGMA quick_check").all()
      if (check.length !== 1 || check[0].quick_check !== "ok") throw new Error("恢复数据库完整性检查失败")
      const migrations = database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count
      const tables = database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get().count
      summary = { verified:true, migrations:Number(migrations), tables:Number(tables) }
    } finally {
      database.close()
    }
    const target = String(process.env.RESTORE_TARGET_PATH || "").trim()
    if (target) {
      const resolvedTarget = path.resolve(target)
      if (fs.existsSync(resolvedTarget)) throw new Error("恢复目标已存在；为防止覆盖数据，请先选择一个不存在的新路径")
      fs.mkdirSync(path.dirname(resolvedTarget), { recursive:true })
      fs.copyFileSync(restoredPath, resolvedTarget, fs.constants.COPYFILE_EXCL)
      fs.chmodSync(resolvedTarget, 0o600)
      summary.restoredTo = resolvedTarget
    }
    console.log(JSON.stringify(summary))
  } finally {
    fs.rmSync(temporaryDirectory, { recursive:true, force:true })
  }
}

main().catch(function(error) {
  console.error("SQLite恢复验收失败：" + error.message)
  process.exit(1)
})
