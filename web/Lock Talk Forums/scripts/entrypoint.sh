#!/usr/bin/env bash
set -euo pipefail

if [ -z "${FLAG:-}" ]; then
  echo "[entrypoint] FATAL: FLAG environment variable is not set." >&2
  exit 1
fi

KC_ADMIN_PASSWORD=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32 || true)
CLIENT_SECRET=$(openssl rand -hex 16)
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_USER_PASSWORD=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 20 || true)

export KC_ADMIN_PASSWORD

cat > /app/config.json <<EOF
{
  "keycloakUrl": "http://127.0.0.1:8080",
  "realm": "locktalk",
  "clientId": "locktalk-app",
  "clientSecret": "${CLIENT_SECRET}",
  "sessionSecret": "${SESSION_SECRET}",
  "adminUsername": "admin",
  "adminUserPassword": "${ADMIN_USER_PASSWORD}",
  "kcAdminPassword": "${KC_ADMIN_PASSWORD}",
  "flag": "${FLAG}"
}
EOF

mkdir -p /opt/keycloak/data/import

sed \
  -e "s|{{CLIENT_SECRET}}|${CLIENT_SECRET}|g" \
  -e "s|{{ADMIN_USER_PASSWORD}}|${ADMIN_USER_PASSWORD}|g" \
  /opt/keycloak-template/realm-template.json \
  > /opt/keycloak/data/import/locktalk-realm.json

echo "[entrypoint] Realm import file written."

exec /usr/bin/supervisord -c /etc/supervisord.conf
