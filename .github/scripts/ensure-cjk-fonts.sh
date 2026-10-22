#!/usr/bin/env bash
set -euo pipefail

# Read the complete result: no optional rg dependency or early-closing pipeline.
cjk_fonts="$(fc-list :lang=zh)"
if [[ -z "${cjk_fonts//[[:space:]]/}" ]]; then
    echo "No Chinese font found; installing the required CJK fonts."
    sudo apt-get update
    sudo apt-get install --yes --no-install-recommends fonts-noto-cjk
    cjk_fonts="$(fc-list :lang=zh)"
fi

if [[ -z "${cjk_fonts//[[:space:]]/}" ]]; then
    echo "Required Chinese font is still unavailable after preparation." >&2
    exit 1
fi
echo "Chinese font support verified."
