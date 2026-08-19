const crypto = require("node:crypto")
const fs = require("node:fs")
const { pipeline } = require("node:stream/promises")
const { decodeKey } = require("./data-protection")

const MAGIC = "SHUZHI-SQLITE-BACKUP-V1"
const TAG_BYTES = 16

async function encryptFile(sourcePath, destinationPath, encodedKey, keyId) {
  const key = decodeKey(encodedKey)
  if (!key) throw new Error("备份加密密钥不能为空")
  const activeKeyId = String(keyId || "backup-primary")
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(activeKeyId)) throw new Error("备份密钥编号格式不正确")
  const iv = crypto.randomBytes(12)
  const header = Buffer.from([MAGIC, activeKeyId, iv.toString("base64url"), ""].join("\n"), "utf8")
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(header)
  fs.writeFileSync(destinationPath, header, { flag:"wx", mode:0o600 })
  try {
    await pipeline(
      fs.createReadStream(sourcePath),
      cipher,
      fs.createWriteStream(destinationPath, { flags:"a", mode:0o600 })
    )
    fs.appendFileSync(destinationPath, cipher.getAuthTag())
  } catch (error) {
    fs.rmSync(destinationPath, { force:true })
    throw error
  }
  return { keyId:activeKeyId, iv:iv.toString("base64url") }
}

function readHeader(filePath) {
  const descriptor = fs.openSync(filePath, "r")
  try {
    const preview = Buffer.alloc(512)
    const bytesRead = fs.readSync(descriptor, preview, 0, preview.length, 0)
    const text = preview.subarray(0, bytesRead).toString("utf8")
    const first = text.indexOf("\n")
    const second = text.indexOf("\n", first + 1)
    const third = text.indexOf("\n", second + 1)
    if (first < 0 || second < 0 || third < 0 || text.slice(0, first) !== MAGIC) throw new Error("不是有效的数智心港湾备份文件")
    return {
      header:preview.subarray(0, third + 1),
      headerBytes:third + 1,
      keyId:text.slice(first + 1, second),
      iv:text.slice(second + 1, third)
    }
  } finally {
    fs.closeSync(descriptor)
  }
}

async function decryptFile(sourcePath, destinationPath, encodedKey, expectedKeyId) {
  const key = decodeKey(encodedKey)
  if (!key) throw new Error("备份解密密钥不能为空")
  const metadata = readHeader(sourcePath)
  if (expectedKeyId && metadata.keyId !== expectedKeyId) throw new Error("备份使用的密钥编号与当前配置不一致")
  const stat = fs.statSync(sourcePath)
  if (stat.size <= metadata.headerBytes + TAG_BYTES) throw new Error("备份文件内容不完整")
  const descriptor = fs.openSync(sourcePath, "r")
  const tag = Buffer.alloc(TAG_BYTES)
  try { fs.readSync(descriptor, tag, 0, TAG_BYTES, stat.size - TAG_BYTES) }
  finally { fs.closeSync(descriptor) }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(metadata.iv, "base64url"))
  decipher.setAAD(metadata.header)
  decipher.setAuthTag(tag)
  try {
    await pipeline(
      fs.createReadStream(sourcePath, { start:metadata.headerBytes, end:stat.size - TAG_BYTES - 1 }),
      decipher,
      fs.createWriteStream(destinationPath, { flags:"wx", mode:0o600 })
    )
  } catch (error) {
    fs.rmSync(destinationPath, { force:true })
    throw error
  }
  return metadata
}

module.exports = { encryptFile, decryptFile, readHeader, MAGIC }
