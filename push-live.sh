#!/usr/bin/env bash
# Wrapper pointing to push.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/push.sh" "$@"
