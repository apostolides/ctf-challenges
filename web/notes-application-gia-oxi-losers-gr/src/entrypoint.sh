#!/bin/bash
set -e

if ! grep -qE '^127\.0\.0\.1\s+app$' /etc/hosts; then
    echo "127.0.0.1 app" >> /etc/hosts
fi

echo "nameserver 1.1.1.1" > /etc/resolv.conf
echo "nameserver 1.0.0.1" >> /etc/resolv.conf

ENV_FILE="/home/node/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "" > "$ENV_FILE"
fi

if ! grep -q '^JWT_SECRET=' "$ENV_FILE"; then
    echo "" >> "$ENV_FILE"
    echo "JWT_SECRET=$(head /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)" >> "$ENV_FILE"
    chown node:node "$ENV_FILE"
fi

exec su -s /bin/bash node -c "$*"
