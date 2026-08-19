const test = require("node:test")
const assert = require("node:assert/strict")
const { createDataProtector } = require("../src/data-protection")

const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

test("AES-256-GCM字段保护可加密并还原JSON", function() {
  const protector = createDataProtector(key, "test-key")
  const source = [{ questionId:1, selectedIndex:2 }]
  const encrypted = protector.protectJson(source, "answers")
  assert.match(encrypted, /^enc:v1:test-key:/)
  assert.equal(encrypted.includes("questionId"), false)
  assert.deepEqual(protector.unprotectJson(encrypted, "answers"), source)
})

test("密文上下文或内容被篡改时拒绝解密", function() {
  const protector = createDataProtector(key, "test-key")
  const encrypted = protector.protectText("敏感跟进记录", "followup")
  assert.throws(function() { protector.unprotectText(encrypted, "answers") })
  assert.throws(function() { protector.unprotectText(encrypted.slice(0, -2) + "aa", "followup") })
})

test("开发环境无密钥时兼容既有明文数据", function() {
  const protector = createDataProtector("", "primary")
  assert.equal(protector.protectText("local-demo", "field"), "local-demo")
  assert.equal(protector.unprotectText("legacy-plaintext", "field"), "legacy-plaintext")
})
