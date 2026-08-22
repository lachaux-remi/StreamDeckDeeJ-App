#!/bin/bash

set -euo pipefail

event_name="${1:-}"
requested_package="${2:-false}"
is_release_pr="${3:-false}"

if [[ "$is_release_pr" == 'true' || ("$event_name" == 'workflow_call' && "$requested_package" == 'true') ]]; then
  echo true
else
  echo false
fi
