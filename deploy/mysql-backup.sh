#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
mkdir -p backups
exec 9>backups/.backup.lock
flock -n 9 || exit 0
keyfile="backups/.encryption-key"
if [[ ! -s "$keyfile" ]]; then
  openssl rand -hex 32 > "$keyfile"
fi
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="backups/mysql-${stamp}.sql.gz.enc"
partial="${target}.partial"
trap 'rm -f -- "$partial"' EXIT
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  | gzip \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass "file:$keyfile" -out "$partial"
mv "$partial" "$target"
sha256sum "$target" > "$target.sha256"
printf '%s\n' "$target"
