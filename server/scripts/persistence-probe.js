const assert = require("node:assert/strict")

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "")
const mode = process.env.PROBE_MODE || "read"
const probeId = process.env.PROBE_ID || "docker-persistence-probe"

async function request(path, options) {
  const response = await fetch(baseUrl + path, options)
  const text = await response.text()
  return { status:response.status, body:text ? JSON.parse(text) : null }
}

async function adminToken() {
  const response = await request("/api/v1/auth/login", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ role:"admin", accountId:"admin", password:"123456" })
  })
  assert.equal(response.status, 200)
  return response.body.data.token
}

async function listSemesters(token) {
  const response = await request("/api/v1/admin/semesters", {
    headers:{ authorization:"Bearer " + token }
  })
  assert.equal(response.status, 200)
  return response.body.data
}

async function main() {
  const token = await adminToken()
  let semesters = await listSemesters(token)
  const exists = semesters.some(function(item) { return item.id === probeId })

  if (mode === "write" && !exists) {
    const response = await request("/api/v1/admin/semesters", {
      method:"POST",
      headers:{ authorization:"Bearer " + token, "content-type":"application/json" },
      body:JSON.stringify({
        id:probeId,
        name:"Docker持久化验收学期",
        startDate:"2035-01-01",
        endDate:"2035-06-30"
      })
    })
    assert.equal(response.status, 201)
    console.log("持久化探针写入成功：" + probeId)
    return
  }

  semesters = exists ? semesters : await listSemesters(token)
  assert.equal(semesters.some(function(item) { return item.id === probeId }), true)
  console.log("持久化探针读取成功：" + probeId)
}

main().catch(function(error) {
  console.error("持久化探针失败：" + error.message)
  process.exit(1)
})
