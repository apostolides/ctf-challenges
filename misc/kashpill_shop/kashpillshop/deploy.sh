#!/bin/bash
set -e

IMAGE=kashpillshop
CONTAINER=kashpillshop
VOLUME=kashpillshop_hs

echo "[*] Building image..."
docker build -t $IMAGE .

echo "[*] Removing old container if exists..."
docker rm -f $CONTAINER 2>/dev/null || true

echo "[*] Starting container..."
docker run -d --name $CONTAINER -v $VOLUME:/var/lib/tor/hidden_service $IMAGE

echo "[*] Waiting for Tor to bootstrap..."
until docker logs $CONTAINER 2>&1 | grep -q "Bootstrapped 100%"; do
    sleep 2
done

ONION=$(docker exec $CONTAINER cat /var/lib/tor/hidden_service/hostname)

echo ""
echo "=============================="
echo "  .onion : $ONION"
echo "=============================="
