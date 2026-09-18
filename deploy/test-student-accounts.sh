#!/usr/bin/env bash
# Verify account workflows against disposable MySQL, never the live database.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
test_db_name="shuzhi-accounts-test-$(date +%s)-$$"
test_db_password="$(openssl rand -hex 24)"
cleanup() { docker rm -fv "$test_db_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$test_db_name" --network none --tmpfs /var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD="$test_db_password" -e MYSQL_DATABASE=shuzhi_accounts_test mysql:8.4 >/dev/null
test_db_ready=false
for attempt in $(seq 1 60); do
  if docker exec -e MYSQL_PWD="$test_db_password" "$test_db_name" mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; then
    test_db_ready=true
    break
  fi
  sleep 2
done
[[ "$test_db_ready" == true ]] || { docker logs --tail 20 "$test_db_name"; exit 1; }
# Share only the disposable DB's isolated loopback network, with no host ports.
docker run --rm --network "container:$test_db_name" \
  -v "$PWD/server/test:/app/server/test:ro" \
  -e NODE_ENV=development -e STUDENT_TEST_MYSQL=1 \
  -e MYSQL_HOST=127.0.0.1 -e MYSQL_USER=root -e MYSQL_PASSWORD="$test_db_password" \
  -e MYSQL_DATABASE=shuzhi_accounts_test \
  shuzhi-backend:mysql node --test test/student-accounts.test.js
