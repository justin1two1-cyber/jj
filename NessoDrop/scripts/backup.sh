#!/usr/bin/env bash
# NessoDrop Postgres backup — produces a timestamped compressed dump.
# Usage: ./scripts/backup.sh [output_dir]
# Run from the NessoDrop project root. Requires the postgres container running.
set -euo pipefail

OUT_DIR="${1:-./data/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$OUT_DIR/nessodrop_$STAMP.sql.gz"

mkdir -p "$OUT_DIR"

echo "Backing up nessodrop database to $FILE ..."
docker compose exec -T postgres pg_dump -U nesso -d nessodrop --no-owner --clean --if-exists \
  | gzip > "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "Backup complete: $FILE ($SIZE)"

# Retention: keep the 14 most recent backups
ls -1t "$OUT_DIR"/nessodrop_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
echo "Retention applied: newest 14 backups kept."
