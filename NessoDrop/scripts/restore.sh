#!/usr/bin/env bash
# NessoDrop Postgres restore — restores a backup produced by backup.sh.
# Usage: ./scripts/restore.sh path/to/nessodrop_YYYYMMDD_HHMMSS.sql.gz
# DESTRUCTIVE: drops and recreates objects in the nessodrop database.
set -euo pipefail

BACKUP_FILE="${1:?Usage: ./scripts/restore.sh <backup_file.sql.gz>}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "About to restore $BACKUP_FILE into the nessodrop database."
echo "This OVERWRITES current data. Press Enter to continue, Ctrl-C to abort."
read -r

echo "Stopping app services (postgres stays up) ..."
docker compose stop api worker openclaw dashboard owner-console

echo "Restoring ..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U nesso -d nessodrop

echo "Restarting services ..."
docker compose start api worker openclaw dashboard owner-console

echo "Restore complete. Verify with: curl -s http://localhost:3001/health"
