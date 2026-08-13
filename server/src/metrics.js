function createMetrics() {
  const startedAt = Date.now()
  const requests = new Map()
  const durations = new Map()

  function observe(method, route, status, durationSeconds) {
    const key = [method, route, status].join("|")
    requests.set(key, (requests.get(key) || 0) + 1)
    const durationKey = [method, route].join("|")
    const current = durations.get(durationKey) || { count:0, sum:0 }
    current.count++
    current.sum += durationSeconds
    durations.set(durationKey, current)
  }

  function escapeLabel(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
  }

  function render() {
    const lines = [
      "# HELP shuzhi_http_requests_total Total HTTP requests.",
      "# TYPE shuzhi_http_requests_total counter"
    ]
    requests.forEach(function(count, key) {
      const parts = key.split("|")
      lines.push('shuzhi_http_requests_total{method="' + escapeLabel(parts[0]) + '",route="' + escapeLabel(parts[1]) + '",status="' + escapeLabel(parts[2]) + '"} ' + count)
    })
    lines.push("# HELP shuzhi_http_request_duration_seconds_sum Accumulated HTTP request duration.")
    lines.push("# TYPE shuzhi_http_request_duration_seconds_sum counter")
    durations.forEach(function(value, key) {
      const parts = key.split("|")
      const labels = '{method="' + escapeLabel(parts[0]) + '",route="' + escapeLabel(parts[1]) + '"}'
      lines.push("shuzhi_http_request_duration_seconds_sum" + labels + " " + value.sum.toFixed(6))
      lines.push("shuzhi_http_request_duration_seconds_count" + labels + " " + value.count)
    })
    lines.push("# HELP shuzhi_process_uptime_seconds Process uptime.")
    lines.push("# TYPE shuzhi_process_uptime_seconds gauge")
    lines.push("shuzhi_process_uptime_seconds " + ((Date.now() - startedAt) / 1000).toFixed(3))
    lines.push("# HELP shuzhi_process_resident_memory_bytes Resident memory.")
    lines.push("# TYPE shuzhi_process_resident_memory_bytes gauge")
    lines.push("shuzhi_process_resident_memory_bytes " + process.memoryUsage().rss)
    return lines.join("\n") + "\n"
  }

  return { observe:observe, render:render }
}

module.exports = { createMetrics }
