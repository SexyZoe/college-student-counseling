const crypto = require("node:crypto")

const PASSWORD_ITERATIONS = 120000

function encode(value) {
  return Buffer.from(value).toString("base64url")
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function normalizeAccountId(value) {
  return String(value || "").trim().toLowerCase()
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, 32, "sha256").toString("base64url")
}

function createPasswordRecord(password, saltValue) {
  const salt = saltValue || crypto.randomBytes(16).toString("base64url")
  return { salt: salt, hash: hashPassword(password, salt) }
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt))
  const expected = Buffer.from(String(expectedHash || ""))
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function signToken(payload, secret) {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = encode(JSON.stringify(payload))
  const signature = crypto.createHmac("sha256", secret).update(header + "." + body).digest("base64url")
  return header + "." + body + "." + signature
}

function issueToken(user, options) {
  const nowSeconds = Math.floor((options.now || Date.now()) / 1000)
  return signToken({
    sub: user.id,
    role: user.role,
    accountId: user.account_id,
    iat: nowSeconds,
    exp: nowSeconds + options.ttlSeconds,
    jti: crypto.randomUUID()
  }, options.secret)
}

function verifyToken(token, options) {
  const parts = String(token || "").split(".")
  if (parts.length !== 3) throw new Error("无效访问令牌")
  const expected = crypto.createHmac("sha256", options.secret).update(parts[0] + "." + parts[1]).digest("base64url")
  const actualBuffer = Buffer.from(parts[2])
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("访问令牌签名无效")
  }
  let payload
  try { payload = JSON.parse(decode(parts[1])) } catch (error) { throw new Error("访问令牌内容无效") }
  const nowSeconds = Math.floor((options.now || Date.now()) / 1000)
  if (!payload.exp || payload.exp <= nowSeconds) throw new Error("访问令牌已过期")
  return payload
}

module.exports = {
  normalizeAccountId,
  createPasswordRecord,
  verifyPassword,
  issueToken,
  verifyToken
}
