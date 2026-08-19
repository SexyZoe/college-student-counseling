function createRateLimiter(options) {
  const now = options && options.now ? options.now : Date.now
  const buckets = new Map()
  let checks = 0

  function cleanup(timestamp) {
    checks++
    if (checks % 1000 !== 0) return
    buckets.forEach(function(bucket, key) {
      if (bucket.resetAt <= timestamp) buckets.delete(key)
    })
  }

  function check(key, limit, windowMs) {
    const timestamp = now()
    cleanup(timestamp)
    const bucketKey = String(key)
    let bucket = buckets.get(bucketKey)
    if (!bucket || bucket.resetAt <= timestamp) {
      bucket = { count:0, resetAt:timestamp + windowMs }
      buckets.set(bucketKey, bucket)
    }
    bucket.count++
    return {
      allowed:bucket.count <= limit,
      limit:limit,
      remaining:Math.max(0, limit - bucket.count),
      retryAfterSeconds:Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000))
    }
  }

  return { check:check, size:function() { return buckets.size } }
}

module.exports = { createRateLimiter }
