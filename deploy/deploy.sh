#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
export COMPOSE_PROGRESS=plain COMPOSE_ANSI=never
test -s .env
if [[ ! -f compose.override.yaml ]]; then
  cp deploy/compose.cloud.yaml compose.override.yaml
fi
docker compose --profile mysql-runtime config -q
# This is a single-instance replacement, not zero-downtime deployment.
if docker compose ps --status running --services | grep -qx mysql; then
  bash deploy/mysql-backup.sh
fi
docker compose --profile mysql-runtime build backend-mysql mysql-migrate
docker compose --profile mysql-runtime up -d --wait --wait-timeout 120 backend-mysql gateway
curl --fail --silent --show-error --max-time 10 http://127.0.0.1/ready
