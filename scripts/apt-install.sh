#!/bin/bash
# Installs Ubuntu packages on CI runners. A stalled mirror once kept
# `apt-get update` waiting for over 20 minutes, so bound every attempt, let apt
# retry and time out its own downloads, and start over up to three times.
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  echo "Usage: $0 <package>..." >&2
  exit 64
fi

options=(
  -o Acquire::Retries=3
  -o Acquire::http::Timeout=30
  -o Acquire::https::Timeout=30
  -o DPkg::Lock::Timeout=120
)
delay="${APT_RETRY_DELAY_SECONDS:-15}"

for attempt in 1 2 3; do
  if timeout 90 sudo apt-get "${options[@]}" update &&
    timeout 240 sudo apt-get "${options[@]}" install -y "$@"; then
    exit 0
  fi
  echo "::warning::apt-get attempt $attempt failed or stalled"
  if [[ "$attempt" -lt 3 ]]; then
    sleep "$((attempt * delay))"
  fi
done
echo "apt-get failed after 3 attempts" >&2
exit 1
