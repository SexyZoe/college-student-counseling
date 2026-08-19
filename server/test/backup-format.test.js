const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { encryptFile, decryptFile, readHeader } = require("../src/backup-format")

const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

test("加密备份格式可流式加密并完整恢复", async function() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shuzhi-backup-format-"))
  const source = path.join(directory, "source.db")
  const encrypted = path.join(directory, "backup.enc")
  const restored = path.join(directory, "restored.db")
  const contents = Buffer.concat([Buffer.from("SQLite format test\n"), Buffer.alloc(1024, 42)])
  fs.writeFileSync(source, contents)
  await encryptFile(source, encrypted, key, "backup-test")
  assert.equal(readHeader(encrypted).keyId, "backup-test")
  await decryptFile(encrypted, restored, key, "backup-test")
  assert.deepEqual(fs.readFileSync(restored), contents)
  fs.rmSync(directory, { recursive:true, force:true })
})

test("错误密钥和被篡改备份均无法恢复", async function() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shuzhi-backup-tamper-"))
  const source = path.join(directory, "source.db")
  const encrypted = path.join(directory, "backup.enc")
  fs.writeFileSync(source, "sensitive-backup")
  await encryptFile(source, encrypted, key, "backup-test")
  await assert.rejects(decryptFile(encrypted, path.join(directory, "wrong.db"), "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd", "backup-test"))
  const contents = fs.readFileSync(encrypted)
  contents[contents.length - 20] ^= 1
  fs.writeFileSync(encrypted, contents)
  await assert.rejects(decryptFile(encrypted, path.join(directory, "tampered.db"), key, "backup-test"))
  fs.rmSync(directory, { recursive:true, force:true })
})
