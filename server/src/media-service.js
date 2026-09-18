const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const { HttpError } = require("./errors")

const MEDIA_TYPES = {
  "image/jpeg": { kind:"image", extension:"jpg" },
  "image/png": { kind:"image", extension:"png" },
  "image/gif": { kind:"image", extension:"gif" },
  "image/webp": { kind:"image", extension:"webp" },
  "video/mp4": { kind:"video", extension:"mp4" },
  "video/webm": { kind:"video", extension:"webm" },
  "video/quicktime": { kind:"video", extension:"mov" }
}

function createMediaServices(database, config, context) {
  const uploadDirectory = config.uploadDirectory || path.join(__dirname, "..", "data", "uploads")
  const maxMediaBytes = Number(config.maxMediaBytes || 100 * 1024 * 1024)

  async function uploadContentMedia(user, input) {
    context.requireRole(user, "counselor")
    input = input || {}
    const buffer = input.buffer
    const mimeType = String(input.mimeType || "").toLowerCase().split(";")[0].trim()
    const type = MEDIA_TYPES[mimeType]
    if (!type) throw new HttpError(415, "MEDIA_TYPE_UNSUPPORTED", "仅支持 JPG、PNG、GIF、WebP 图片和 MP4、WebM、MOV 视频")
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new HttpError(422, "MEDIA_EMPTY", "上传文件不能为空")
    if (buffer.length > maxMediaBytes) throw new HttpError(413, "MEDIA_TOO_LARGE", "单个媒体文件不能超过 " + Math.floor(maxMediaBytes / 1024 / 1024) + "MB")
    if (!matchesSignature(buffer, mimeType)) throw new HttpError(422, "MEDIA_SIGNATURE_INVALID", "文件内容与声明的媒体格式不一致")

    const originalName = cleanFileName(input.fileName, type.extension)
    const id = crypto.randomUUID()
    const storageName = id + "." + type.extension
    const target = path.join(uploadDirectory, storageName)
    await fs.promises.mkdir(uploadDirectory, { recursive:true, mode:0o700 })
    await fs.promises.writeFile(target, buffer, { flag:"wx", mode:0o600 })
    try {
      await database.prepare(`
        INSERT INTO media_assets
          (id, owner_user_id, content_item_id, kind, original_name, storage_name, mime_type, byte_size, created_at)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
      `).run(id, user.id, type.kind, originalName, storageName, mimeType, buffer.length, context.nowIso())
    } catch (error) {
      await fs.promises.unlink(target).catch(function() {})
      throw error
    }
    await context.audit(user.id, "上传文章媒体", "media_asset", id, { kind:type.kind, byteSize:buffer.length })
    return mapMedia({ id, kind:type.kind, original_name:originalName, storage_name:storageName, mime_type:mimeType, byte_size:buffer.length })
  }

  async function claimContentMedia(user, mediaIds, contentId) {
    const ids = normalizeMediaIds(mediaIds)
    const media = []
    for (const id of ids) {
      const row = await database.prepare("SELECT * FROM media_assets WHERE id = ?").get(id)
      if (!row || row.owner_user_id !== user.id || row.content_item_id) {
        throw new HttpError(422, "MEDIA_NOT_AVAILABLE", "文章媒体不存在、已被使用或不属于当前账号")
      }
      media.push(mapMedia(row))
    }
    for (const id of ids) {
      await database.prepare("UPDATE media_assets SET content_item_id = ? WHERE id = ? AND owner_user_id = ? AND content_item_id IS NULL")
        .run(contentId, id, user.id)
    }
    return media
  }

  async function getPublishedMedia(storageName) {
    if (!/^[0-9a-f-]{36}\.(?:jpg|png|gif|webp|mp4|webm|mov)$/.test(String(storageName || ""))) return null
    const row = await database.prepare(`
      SELECT ma.* FROM media_assets ma
      JOIN content_items ci ON ci.id = ma.content_item_id
      WHERE ma.storage_name = ?
    `).get(storageName)
    if (!row) return null
    return {
      path:path.join(uploadDirectory, row.storage_name),
      mimeType:row.mime_type,
      byteSize:Number(row.byte_size),
      originalName:row.original_name
    }
  }

  return { uploadContentMedia, claimContentMedia, getPublishedMedia }
}

function normalizeMediaIds(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new HttpError(422, "MEDIA_INVALID", "mediaIds 必须是数组")
  if (value.length > 9) throw new HttpError(422, "MEDIA_TOO_MANY", "每篇文章最多添加9个图片或视频")
  const ids = value.map(function(id) { return String(id || "").trim() })
  if (ids.some(function(id) { return !/^[0-9a-f-]{36}$/.test(id) })) throw new HttpError(422, "MEDIA_INVALID", "媒体编号不合法")
  if (new Set(ids).size !== ids.length) throw new HttpError(422, "MEDIA_INVALID", "文章媒体不能重复")
  return ids
}

function mapMedia(row) {
  return {
    id:row.id,
    kind:row.kind,
    name:row.original_name,
    mimeType:row.mime_type,
    size:Number(row.byte_size),
    url:"/media/" + row.storage_name
  }
}

function cleanFileName(value, extension) {
  const cleaned = path.basename(String(value || "")).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 220)
  return cleaned || "upload." + extension
}

function matchesSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
  if (mimeType === "image/gif") return buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  if (mimeType === "video/webm") return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp"
  return false
}

module.exports = { createMediaServices, normalizeMediaIds, mapMedia, matchesSignature }
