#!/usr/bin/env bash
# Restores into a disposable, network-isolated MySQL container, never live data.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
backup="${1:?Pass the backup path returned by mysql-backup.sh}"
sha256sum -c "$backup.sha256"
name="shuzhi-restore-$(date +%s)-$$"
cleanup() { docker rm -fv "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" --network none --tmpfs /var/lib/mysql \
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=shuzhi_restore mysql:8.4 >/dev/null
ready=false
for attempt in $(seq 1 60); do
  if docker exec "$name" mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[[ "$ready" == true ]] || { docker logs --tail 20 "$name"; exit 1; }
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:backups/.encryption-key -in "$backup" \
  | gzip -dc | docker exec -i "$name" mysql shuzhi_restore
tables="$(docker exec "$name" mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='shuzhi_restore'")"
[[ "$tables" -ge 12 ]]
docker exec "$name" mysql -N shuzhi_restore -e 'SELECT COUNT(*) AS migration_count FROM schema_migrations; SELECT COUNT(*) AS semester_count FROM semesters;'
printf 'Restore verified: %s tables imported into disposable container. Live database untouched.\n' "$tables"
