#!/usr/bin/env bash
# Usage: bash deploy/ecs/publish.sh /root/guiyan-release.tar.gz RELEASE_ID
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
archive=$(realpath "${1:?archive required}")
release_id=${2:?release ID required}
[[ $release_id =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$ ]]
release_dir="/opt/guiyan/releases/$release_id"
[[ ! -e $release_dir ]] || { echo 'Release already exists' >&2; exit 1; }
install -d -o guiyan -g guiyan -m 755 "$release_dir"
tar --no-same-owner -xzf "$archive" -C "$release_dir"
chown -R guiyan:guiyan "$release_dir"
cd "$release_dir"
runuser -u guiyan -- npm ci --registry=https://registry.npmjs.org --no-audit --no-fund
runuser -u guiyan -- npm run build
runuser -u guiyan -- npm run check:mini
chown -R root:root "$release_dir"
chmod -R u=rwX,go=rX "$release_dir"

# Optional one-time import, before the application can seed an empty database.
if [[ -n ${3:-} ]]; then
    snapshot_path=$(realpath "$3")
    /usr/local/bin/node --env-file=/etc/guiyan/demo.env deploy/ecs/import-snapshot.mjs < "$snapshot_path"
fi

previous=$(readlink -f /opt/guiyan/current || true)
ln -sfn "$release_dir" /opt/guiyan/current.next
mv -Tf /opt/guiyan/current.next /opt/guiyan/current
# Keep the database secret intact and replace only this release marker.
sed -i '/^DEPLOYMENT_VERSION=/d' /etc/guiyan/demo.env
printf 'DEPLOYMENT_VERSION=%s\n' "$release_id" >> /etc/guiyan/demo.env
chmod 600 /etc/guiyan/demo.env
install -m 644 deploy/ecs/guiyan.service /etc/systemd/system/guiyan.service
install -m 644 deploy/ecs/guiyan-backup.service /etc/systemd/system/guiyan-backup.service
install -m 644 deploy/ecs/guiyan-backup.timer /etc/systemd/system/guiyan-backup.timer
install -m 755 deploy/ecs/backup.sh /usr/local/sbin/guiyan-backup
systemctl daemon-reload
systemctl enable guiyan guiyan-backup.timer
systemctl restart guiyan
for attempt in $(seq 1 30); do
    if curl --silent --fail http://127.0.0.1:3001/api/health >/dev/null; then break; fi
    sleep 1
done
if ! curl --silent --fail http://127.0.0.1:3001/api/health; then
    if [[ -n $previous && -d $previous ]]; then
        ln -sfn "$previous" /opt/guiyan/current
        sed -i '/^DEPLOYMENT_VERSION=/d' /etc/guiyan/demo.env
        printf 'DEPLOYMENT_VERSION=%s\n' "$(basename "$previous")" >> /etc/guiyan/demo.env
        systemctl restart guiyan
    fi
    echo 'Health check failed; inspect journalctl -u guiyan' >&2
    exit 1
fi
install -m 644 deploy/ecs/nginx.conf /etc/nginx/sites-available/guiyan
ln -sfn /etc/nginx/sites-available/guiyan /etc/nginx/sites-enabled/guiyan
if [[ -L /etc/nginx/sites-enabled/default ]]; then unlink /etc/nginx/sites-enabled/default; fi
nginx -t
systemctl reload nginx
systemctl start guiyan-backup.timer guiyan-backup.service
echo
echo "Published $release_id"
