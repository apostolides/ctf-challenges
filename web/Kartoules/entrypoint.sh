#!/bin/sh
set -e
FLAGFILE="/app/flag_$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 32)"
echo 'GRT26{lf1_w17h_4_7w157}' > "$FLAGFILE"
exec node index.js
