#!/usr/bin/env bash
#
# Automated MariaDB backup (UR-010.4, D-010).
#
# Dumps the `db` container to a gzip'd mysqldump on the VPS, keeps the 7 most
# recent daily backups and the 4 most recent weekly backups. Weekly backups
# (default: every Friday, system day-of-week = 5) double as the daily entry of
# that day and are matched by the `weekly-` prefix for their own retention.
#
# Run from the repo root. Recommended cron entry (as the deploy user):
#
#   0 2 * * * cd /opt/eventos && ./scripts/backup.sh >> /var/log/eventos-backup.log 2>&1
#
# Overridable env: BACKUP_DIR, KEEP_DAILY, KEEP_WEEKLY, WEEKLY_DOW.
set -euo pipefail
shopt -s nullglob

BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
WEEKLY_DOW="${WEEKLY_DOW:-5}"

mkdir -p "$BACKUP_DIR"
TODAY="$(date +%Y-%m-%d)"
PREFIX="daily"
[ "$(date +%u)" -eq "$WEEKLY_DOW" ] && PREFIX="weekly"

OUT="${BACKUP_DIR}/${PREFIX}-${TODAY}.sql.gz"
TMP="${OUT}.tmp"

# Dump straight out of the running db container using its own credentials
# (MYSQL_ROOT_PASSWORD / MYSQL_DATABASE are set by docker-compose.yml).
docker compose exec -T db sh -c \
  'exec mysqldump --single-transaction --quick --routines --triggers \
   -u root -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}"' \
  | gzip > "$TMP"
mv "$TMP" "$OUT"
echo "[backup] wrote ${OUT} ($(du -h "$OUT" | cut -f1))"

# --- Retention ---------------------------------------------------------------
prune() {
  local glob="$1" keep="$2" i=0
  # `ls -t` = newest first; keep the newest $keep, delete the rest.
  for f in $(ls -t "${BACKUP_DIR}"/${glob}-*.sql.gz 2>/dev/null); do
    i=$((i + 1))
    if (( i > keep )); then
      rm -f "$f"
      echo "[backup] pruned $f"
    fi
  done
}
prune daily "${KEEP_DAILY}"
prune weekly "${KEEP_WEEKLY}"

echo "[backup] done — $(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | wc -l) backup(s) retained"
