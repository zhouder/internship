#!/usr/bin/env bash
# Ubuntu 22.04 x86_64, run as root. No private keys or cloud credentials needed.
set -euo pipefail
umask 022
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
[[ $(uname -m) == x86_64 ]] || { echo 'Requires x86_64' >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get -o DPkg::Lock::Timeout=60 install -y -qq nginx postgresql postgresql-client curl xz-utils ca-certificates

if ! /usr/local/bin/node --version 2>/dev/null | grep -q '^v22\.'; then
    download_dir=$(mktemp -d)
    trap 'rm -rf -- "$download_dir"' EXIT
    curl --retry 3 --connect-timeout 15 --max-time 120 -fsSL \
        https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o "$download_dir/SHASUMS256.txt"
    node_file=$(awk '$2 ~ /^node-v22\.[0-9]+\.[0-9]+-linux-x64.tar.xz$/ { print $2 }' "$download_dir/SHASUMS256.txt")
    [[ $node_file =~ ^node-v22\.[0-9]+\.[0-9]+-linux-x64.tar.xz$ ]]
    curl --retry 3 --connect-timeout 15 --max-time 300 -fsSL \
        "https://nodejs.org/dist/latest-v22.x/$node_file" -o "$download_dir/$node_file"
    (cd "$download_dir" && grep "  $node_file\$" SHASUMS256.txt | sha256sum --check --status)
    tar -xJf "$download_dir/$node_file" -C /usr/local --strip-components=1
fi

id guiyan >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/guiyan --shell /usr/sbin/nologin guiyan
install -d -m 755 /opt/guiyan /opt/guiyan/releases
install -d -m 700 /etc/guiyan
install -d -o postgres -g postgres -m 700 /var/backups/guiyan
systemctl enable --now postgresql nginx

if [[ ! -f /etc/guiyan/demo.env ]]; then
    # Only letters/digits in generated secrets; never printed or passed on a command line.
    db_password=$(openssl rand -hex 32)
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q <<SQL
CREATE ROLE guiyan LOGIN PASSWORD '$db_password';
CREATE DATABASE guiyan OWNER guiyan;
SQL
    umask 077
    printf 'DATABASE_URL=postgresql://guiyan:%s@127.0.0.1:5432/guiyan?sslmode=disable\n' "$db_password" > /etc/guiyan/demo.env
    unset db_password
fi
chmod 600 /etc/guiyan/demo.env
node --version
psql --version
echo 'Runtime installed. Database listens on localhost; publish the app next.'
