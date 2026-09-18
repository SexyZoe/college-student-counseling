#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
curl --fail --silent --show-error --max-time 10 http://127.0.0.1/ready >/dev/null
docker compose exec -T backend-mysql node -e '
fetch("http://127.0.0.1:8787/metrics", {headers:{Authorization:"Bearer " + process.env.METRICS_TOKEN}})
.then(async r => {if(!r.ok) throw new Error("metrics HTTP " + r.status); console.log(await r.text())})
.catch(e => {console.error(e.message); process.exit(1)})'
