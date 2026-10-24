#!/usr/bin/env bash
set -euo pipefail

# Read the complete result: no optional rg dependency or early-closing pipeline.
cjk_fonts="$(fc-list :lang=zh)"
if [[ -z "${cjk_fonts//[[:space:]]/}" ]]; then
    echo "No Chinese font found; installing the required CJK fonts."
    source /etc/os-release
    if [[ "${ID:-}" != ubuntu || ! "${VERSION_CODENAME:-}" =~ ^[a-z]+$ ]]; then
        echo "CJK font installation requires an identified Ubuntu runner." >&2
        exit 1
    fi
    cjk_keyring=/usr/share/keyrings/ubuntu-archive-keyring.gpg
    if ! test -r "$cjk_keyring"; then
        echo "Ubuntu archive signing keyring is unavailable." >&2
        exit 1
    fi
    # Only this invocation uses these signed official sources. Do not edit the
    # runner's repositories or let unrelated third-party indexes block fonts.
    cjk_sources="$(mktemp)"
    trap 'rm -f -- "$cjk_sources"' EXIT
    printf 'deb [signed-by=%s] https://archive.ubuntu.com/ubuntu %s main\n' "$cjk_keyring" "$VERSION_CODENAME" > "$cjk_sources"
    printf 'deb [signed-by=%s] https://archive.ubuntu.com/ubuntu %s-updates main\n' "$cjk_keyring" "$VERSION_CODENAME" >> "$cjk_sources"
    printf 'deb [signed-by=%s] https://security.ubuntu.com/ubuntu %s-security main\n' "$cjk_keyring" "$VERSION_CODENAME" >> "$cjk_sources"
    cjk_apt=(-o "Dir::Etc::sourcelist=$cjk_sources" -o 'Dir::Etc::sourceparts=-' -o 'APT::Get::List-Cleanup=0' -o 'APT::Update::Error-Mode=any')
    sudo apt-get "${cjk_apt[@]}" update
    sudo apt-get "${cjk_apt[@]}" install --yes --no-install-recommends fonts-noto-cjk
    cjk_fonts="$(fc-list :lang=zh)"
fi

if [[ -z "${cjk_fonts//[[:space:]]/}" ]]; then
    echo "Required Chinese font is still unavailable after preparation." >&2
    exit 1
fi
echo "Chinese font support verified."
