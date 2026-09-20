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
media_target="backups/media-${stamp}.tar.gz.enc"
media_partial="${media_target}.partial"
trap 'rm -f -- "$partial" "$media_partial"' EXIT
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  | gzip \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass "file:$keyfile" -out "$partial"
mv "$partial" "$target"
sha256sum "$target" > "$target.sha256"
if docker compose exec -T backend-mysql test -d /app/data/uploads; then
  docker compose exec -T backend-mysql tar -C /app/data -czf - uploads \
    | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass "file:$keyfile" -out "$media_partial"
  mv "$media_partial" "$media_target"
  sha256sum "$media_target" > "$media_target.sha256"
  printf '%s\n%s\n' "$target" "$media_target"
else
  # Compatibility for the first upgrade from a version that had no media volume.
  printf '%s\n' "$target"
fi
