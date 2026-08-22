#!/bin/bash

set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "Usage: $0 <executable> <log-file>" >&2
  exit 2
fi

executable="$1"
log_file="$2"
poll_interval="${SMOKE_POLL_INTERVAL_SECONDS:-0.25}"
timeout_seconds="${SMOKE_TIMEOUT_SECONDS:-30}"
readiness_marker='Linux updater mode: disabled'
exception_marker='A JavaScript error occurred in the main process'
smoke_pid=''
config_directory="$(mktemp -d)"

cleanup() {
  local original_status=$?
  trap - EXIT INT TERM

  if [[ -n "$smoke_pid" ]] && kill -0 "$smoke_pid" 2>/dev/null; then
    kill -TERM -- "-$smoke_pid" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "$smoke_pid" 2>/dev/null || break
      sleep 0.05
    done
    if kill -0 "$smoke_pid" 2>/dev/null; then
      kill -KILL -- "-$smoke_pid" 2>/dev/null || true
    fi
  fi

  if [[ -n "$smoke_pid" ]]; then
    wait "$smoke_pid" 2>/dev/null || true
  fi
  rm -rf "$config_directory"
  exit "$original_status"
}

fail_with_log() {
  echo "$1" >&2
  echo "--- $log_file ---" >&2
  cat "$log_file" >&2
  exit 1
}

trap cleanup EXIT INT TERM
: > "$log_file"
XDG_CONFIG_HOME="$config_directory" setsid xvfb-run -a "$executable" --no-sandbox > "$log_file" 2>&1 &
smoke_pid=$!
deadline=$((SECONDS + timeout_seconds))

while ((SECONDS < deadline)); do
  if grep -Fq "$exception_marker" "$log_file"; then
    fail_with_log "Smoke detected a main-process exception in $executable"
  fi

  if grep -Fq "$readiness_marker" "$log_file"; then
    if ! kill -0 "$smoke_pid" 2>/dev/null; then
      set +e
      wait "$smoke_pid"
      status=$?
      set -e
      smoke_pid=''
      fail_with_log "Smoke process exited with status $status after readiness for $executable"
    fi

    sleep "$poll_interval"
    if grep -Fq "$exception_marker" "$log_file"; then
      fail_with_log "Smoke detected a main-process exception in $executable"
    fi
    if ! kill -0 "$smoke_pid" 2>/dev/null; then
      set +e
      wait "$smoke_pid"
      status=$?
      set -e
      smoke_pid=''
      fail_with_log "Smoke process exited with status $status after readiness for $executable"
    fi

    exit 0
  fi

  if ! kill -0 "$smoke_pid" 2>/dev/null; then
    set +e
    wait "$smoke_pid"
    status=$?
    set -e
    smoke_pid=''
    fail_with_log "Smoke process exited before readiness with status $status for $executable"
  fi

  sleep "$poll_interval"
done

if grep -Fq "$exception_marker" "$log_file"; then
  fail_with_log "Smoke detected a main-process exception in $executable"
fi
fail_with_log "Smoke readiness marker was absent after $timeout_seconds seconds for $executable"
