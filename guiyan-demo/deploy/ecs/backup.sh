#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir=/var/backups/guiyan
mkdir -p "$backup_dir"
dump_path="$backup_dir/guiyan-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-acl --dbname=guiyan --file="$dump_path.tmp"
mv "$dump_path.tmp" "$dump_path"
pg_restore --list "$dump_path" >/dev/null
find "$backup_dir" -maxdepth 1 -type f -name 'guiyan-*.dump' -mtime +7 -delete
echo "Database backup completed: $(basename "$dump_path")"
