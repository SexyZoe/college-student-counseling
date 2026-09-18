const crypto = require("node:crypto")

const LEGACY_PASSWORD_ITERATIONS = 120000
const PASSWORD_ITERATIONS = 600000
const PASSWORD_PREFIX = "pbkdf2-sha256"

function encode(value) {
  return Buffer.from(value).toString("base64url")
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function normalizeAccountId(value) {
  return String(value || "").trim().toLowerCase()
}

function hashPassword(password, salt, iterations) {
  return crypto.pbkdf2Sync(String(password), salt, iterations || PASSWORD_ITERATIONS, 32, "sha256").toString("base64url")
}

function hashPasswordAsync(password, salt, iterations) {
  return new Promise(function(resolve, reject) {
    crypto.pbkdf2(String(password), salt, iterations || PASSWORD_ITERATIONS, 32, "sha256", function(error, value) {
      if (error) reject(error)
      else resolve(value.toString("base64url"))
    })
  })
}

function createPasswordRecord(password, saltValue) {
  const salt = saltValue || crypto.randomBytes(16).toString("base64url")
  return { salt: salt, hash: [PASSWORD_PREFIX, PASSWORD_ITERATIONS, hashPassword(password, salt, PASSWORD_ITERATIONS)].join("$") }
}

async function createPasswordRecordAsync(password, saltValue) {
  const salt = saltValue || crypto.randomBytes(16).toString("base64url")
  return { salt:salt, hash:[PASSWORD_PREFIX, PASSWORD_ITERATIONS, await hashPasswordAsync(password, salt, PASSWORD_ITERATIONS)].join("$") }
}

function verifyPassword(password, salt, expectedHash) {
  const stored = String(expectedHash || "")
  const parts = stored.split("$")
  const versioned = parts.length === 3 && parts[0] === PASSWORD_PREFIX && /^\d+$/.test(parts[1])
  const iterations = versioned ? Number(parts[1]) : LEGACY_PASSWORD_ITERATIONS
  const digest = versioned ? parts[2] : stored
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) return false
  const actual = Buffer.from(hashPassword(password, salt, iterations))
  const expected = Buffer.from(digest)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

async function verifyPasswordAsync(password, salt, expectedHash) {
  const stored = String(expectedHash || "")
  const parts = stored.split("$")
  const versioned = parts.length === 3 && parts[0] === PASSWORD_PREFIX && /^\d+$/.test(parts[1])
  const iterations = versioned ? Number(parts[1]) : LEGACY_PASSWORD_ITERATIONS
  const digest = versioned ? parts[2] : stored
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) return false
  const actual = Buffer.from(await hashPasswordAsync(password, salt, iterations))
  const expected = Buffer.from(digest)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function passwordNeedsUpgrade(expectedHash) {
  const parts = String(expectedHash || "").split("$")
  return parts.length !== 3 || parts[0] !== PASSWORD_PREFIX || Number(parts[1]) < PASSWORD_ITERATIONS
}

function tokenIdHash(jti) {
  return crypto.createHash("sha256").update(String(jti || "")).digest("hex")
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
    ver: Number(user.auth_version || 0),
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
  createPasswordRecordAsync,
  verifyPassword,
  verifyPasswordAsync,
  passwordNeedsUpgrade,
  issueToken,
  verifyToken,
  tokenIdHash,
  PASSWORD_ITERATIONS
}
