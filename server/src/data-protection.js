const crypto = require("node:crypto")

const PREFIX = "enc:v1:"

function decodeKey(value) {
  const text = String(value || "").trim()
  if (!text) return null
  const key = /^[a-f0-9]{64}$/i.test(text) ? Buffer.from(text, "hex") : Buffer.from(text, "base64")
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY 必须是32字节密钥（64位十六进制或Base64）")
  return key
}

function createDataProtector(encodedKey, keyId) {
  const key = decodeKey(encodedKey)
  const activeKeyId = String(keyId || "primary").trim()
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(activeKeyId)) throw new Error("DATA_ENCRYPTION_KEY_ID 格式不正确")

  function protectText(value, context) {
    const text = String(value === undefined || value === null ? "" : value)
    if (!key) return text
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    cipher.setAAD(Buffer.from(String(context || "shuzhi-sensitive-field")))
    const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return [PREFIX + activeKeyId, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":")
  }

  function unprotectText(value, context) {
    const text = String(value === undefined || value === null ? "" : value)
    if (!text.startsWith(PREFIX)) return text
    if (!key) throw new Error("数据已加密，但当前实例未配置 DATA_ENCRYPTION_KEY")
    const parts = text.split(":")
    if (parts.length !== 6 || parts[2] !== activeKeyId) throw new Error("加密数据的密钥版本不可用")
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[3], "base64url"))
    decipher.setAAD(Buffer.from(String(context || "shuzhi-sensitive-field")))
    decipher.setAuthTag(Buffer.from(parts[4], "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(parts[5], "base64url")), decipher.final()]).toString("utf8")
  }

  return {
    enabled:!!key,
    protectText:protectText,
    unprotectText:unprotectText,
    protectJson:function(value, context) { return protectText(JSON.stringify(value), context) },
    unprotectJson:function(value, context) { return JSON.parse(unprotectText(value, context)) }
  }
}

module.exports = { createDataProtector, decodeKey }
