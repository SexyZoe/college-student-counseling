const LEVELS = { debug:10, info:20, warn:30, error:40 }
const REDACTED_KEYS = /password|secret|token|authorization|answer|followup|cookie|encryption|phone|csvText/i

function sanitize(value, depth) {
  if (depth > 4) return "[MAX_DEPTH]"
  if (Array.isArray(value)) return value.slice(0, 20).map(function(item) { return sanitize(item, depth + 1) })
  if (!value || typeof value !== "object") return value
  const result = {}
  Object.keys(value).slice(0, 50).forEach(function(key) {
    result[key] = REDACTED_KEYS.test(key) ? "[REDACTED]" : sanitize(value[key], depth + 1)
  })
  return result
}

function createLogger(level, sink) {
  const threshold = LEVELS[level] || LEVELS.info
  const write = sink || function(line, severity) {
    if (severity === "error") console.error(line)
    else if (severity === "warn") console.warn(line)
    else console.log(line)
  }
  function log(severity, event, fields) {
    if ((LEVELS[severity] || LEVELS.info) < threshold) return
    const record = Object.assign({
      timestamp:new Date().toISOString(),
      level:severity,
      event:String(event || "application_event"),
      service:"shuzhi-heart-harbor-server"
    }, sanitize(fields || {}, 0))
    write(JSON.stringify(record), severity)
  }
  return {
    debug:function(event, fields) { log("debug", event, fields) },
    info:function(event, fields) { log("info", event, fields) },
    warn:function(event, fields) { log("warn", event, fields) },
    error:function(event, fields) { log("error", event, fields) }
  }
}

module.exports = { createLogger, sanitize }
