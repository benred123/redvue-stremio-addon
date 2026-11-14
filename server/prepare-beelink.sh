#!/usr/bin/env bash
# Prepare REDVUE's directories on the Beelink after installing Ubuntu + Docker.
# Does not install Docker, erase disks, expose public ports or launch services.
set -euo pipefail

command -v docker >/dev/null || { echo "Docker Engine is not installed." >&2; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose plugin is not installed or Docker cannot be accessed." >&2; exit 1; }

ROOT="/srv/redvue"
sudo mkdir -p "$ROOT/media" "$ROOT/config"
sudo chown -R "$(id -u):$(id -g)" "$ROOT"
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/compose.yaml"
cp "$SOURCE" "$ROOT/compose.yaml"

echo "Prepared REDVUE at $ROOT"
echo "Copy the media folders into $ROOT/media then:"
echo "    cd $ROOT && docker compose up -d"
echo "Open on your LAN: http://BEELINK-IP:8409"
if [ -e /dev/dri/renderD128 ]; then
  echo "Detected Intel render device; GPU acceleration can be assessed later."
else
  echo "No /dev/dri/renderD128 detected yet; leave GPU passthrough disabled."
fi
