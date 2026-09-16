#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
port="${1:-8558}"

if [[ "$port" == "8558" ]] && systemctl --user is-active --quiet qclock-quads-page.service 2>/dev/null; then
  echo "Already running via systemd at http://127.0.0.1:${port}/"
  echo "Stop with: systemctl --user stop qclock-quads-page.service"
  exit 0
fi
if [[ "$port" == "8558" ]] && systemctl --user list-unit-files qclock-quads-page.service --no-legend 2>/dev/null | grep -q qclock-quads-page; then
  echo "Starting systemd unit qclock-quads-page.service"
  systemctl --user start qclock-quads-page.service
  echo "Four-symbol page at http://127.0.0.1:${port}/"
  exit 0
fi

port_in_use() {
  ss -H -tln "sport = :$1" 2>/dev/null | grep -q .
}

if port_in_use "$port"; then
  echo "Already running at http://127.0.0.1:${port}/"
  exit 0
fi

echo "Four-symbol page at http://127.0.0.1:${port}/"
exec python3 -m http.server "$port" --bind 127.0.0.1
