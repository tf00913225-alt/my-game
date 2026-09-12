#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
    printf '%s\n' "Usage: $0 <keystore-path> <key-alias>" >&2
    printf '%s\n' "Example debug keystore path: <your-user-home>/.android/debug.keystore" >&2
    exit 64
fi

KEYSTORE_PATH=$1
KEY_ALIAS=$2

keytool -exportcert -alias "$KEY_ALIAS" -keystore "$KEYSTORE_PATH" | openssl sha1 -binary | openssl base64
