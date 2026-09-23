const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const http = require("node:http")
const os = require("node:os")
const path = require("node:path")
const { openDatabase, seedDemoData } = require("../src/database")
const { createServices } = require("../src/services")
const { createHttpApp } = require("../src/app")

test("Web管理端与文章媒体上传闭环", async function(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shuzhi-media-"))
  const database = openDatabase(":memory:")
  await seedDemoData(database)
  const config = {
    authSecret:"web-media-test-secret",
    dataEncryptionKey:"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    dataEncryptionKeyId:"test-primary",
    tokenTtlSeconds:3600,
    maxBodyBytes:1024 * 1024,
    maxMediaBytes:1024 * 1024,
    uploadDirectory:directory,
    webRoot:path.join(__dirname, "..", "web"),
    logLevel:"error"
  }
  const server = http.createServer(createHttpApp(createServices(database, config), config))
  await new Promise(function(resolve) { server.listen(0, "127.0.0.1", resolve) })
  const baseUrl = "http://127.0.0.1:" + server.address().port

  async function request(url, options) {
    const response = await fetch(baseUrl + url, options)
    const text = await response.text()
    let body
    try { body = JSON.parse(text) } catch (error) { body = text }
    return { response, body }
  }
  async function login(role, accountId) {
    const result = await request("/api/v1/auth/login", {
      method:"POST", headers:{ "content-type":"application/json" },
      body:JSON.stringify({ role, accountId, password:"123456" })
    })
    assert.equal(result.response.status, 200)
    return result.body.data.token
  }
  const counselor = await login("counselor", "T001")
  const admin = await login("admin", "admin")
  const student = await login("student", "2024001")

  await t.test("Web入口和静态资源由同一服务提供", async function() {
    let result = await request("/")
    assert.equal(result.response.status, 200)
    assert.match(result.body, /校园管理端/)
    result = await request("/web/app.js")
    assert.equal(result.response.status, 200)
    assert.match(result.response.headers.get("content-type"), /javascript/)
    assert.match(result.body, /xlsxToCsv/)
    assert.match(result.body, /newClientBatchId/)
    assert.doesNotMatch(result.body, /clientBatchId:"web:"\+crypto\.randomUUID/)
  })

  let image
  let video
  await t.test("仅辅导员可上传经文件签名校验的媒体", async function() {
    const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(20)])
    let result = await request("/api/v1/counselor/media", {
      method:"POST", headers:{ authorization:"Bearer " + student, "content-type":"image/png", "x-file-name":encodeURIComponent("越权.png") }, body:png
    })
    assert.equal(result.response.status, 403)
    result = await request("/api/v1/counselor/media", {
      method:"POST", headers:{ authorization:"Bearer " + counselor, "content-type":"image/jpeg", "x-file-name":"fake.jpg" }, body:png
    })
    assert.equal(result.response.status, 422)
    assert.equal(result.body.error.code, "MEDIA_SIGNATURE_INVALID")
    result = await request("/api/v1/counselor/media", {
      method:"POST", headers:{ authorization:"Bearer " + counselor, "content-type":"image/png", "x-file-name":encodeURIComponent("校园图片.png") }, body:png
    })
    assert.equal(result.response.status, 201)
    image = result.body.data
    assert.equal(image.kind, "image")
    const mp4 = Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from("ftyp"), Buffer.alloc(24)])
    result = await request("/api/v1/counselor/media", {
      method:"POST", headers:{ authorization:"Bearer " + counselor, "content-type":"video/mp4", "x-file-name":encodeURIComponent("校园视频.mp4") }, body:mp4
    })
    assert.equal(result.response.status, 201)
    video = result.body.data
    assert.equal(video.kind, "video")
    assert.equal(fs.readdirSync(directory).length, 2)
  })

  let contentId
  await t.test("媒体与辅导员文章绑定并进入审核", async function() {
    let result = await request(image.url)
    assert.equal(result.response.status, 404)
    result = await request("/api/v1/counselor/content-items", {
      method:"POST", headers:{ authorization:"Bearer " + counselor, "content-type":"application/json" },
      body:JSON.stringify({ type:"psychoeducation", title:"学会照顾自己", category:"压力管理", summary:"一份简短的自我照顾指南", content:"先停下来，观察情绪，再选择适合自己的行动。", mediaIds:[image.id, video.id] })
    })
    assert.equal(result.response.status, 201)
    contentId = result.body.data.id
    assert.deepEqual(result.body.data.media.map(function(item) { return item.id }), [image.id, video.id])
    result = await request(image.url)
    assert.equal(result.response.status, 200)
    assert.equal(result.response.headers.get("content-type"), "image/png")
    result = await request(video.url, { headers:{ range:"bytes=4-11" } })
    assert.equal(result.response.status, 206)
    assert.equal(result.response.headers.get("content-range"), "bytes 4-11/32")
    assert.equal(Buffer.from(result.body).length, 8)
  })

  await t.test("管理员审核后学生端获得同一媒体地址", async function() {
    let result = await request("/api/v1/admin/content-items/" + contentId + "/review", {
      method:"PATCH", headers:{ authorization:"Bearer " + admin, "content-type":"application/json" },
      body:JSON.stringify({ status:"已发布", reviewNote:"" })
    })
    assert.equal(result.response.status, 200)
    result = await request("/api/v1/content-items?type=psychoeducation", { headers:{ authorization:"Bearer " + student } })
    const article = result.body.data.find(function(item) { return item.id === contentId })
    assert.ok(article)
    assert.equal(article.media[0].url, image.url)
  })

  await new Promise(function(resolve) { server.close(resolve) })
  database.close()
  fs.rmSync(directory, { recursive:true, force:true })
})
