#!/bin/sh
# Generates a self-signed cert at startup if no real cert exists yet.
# Lets nginx start cleanly both locally (DOMAIN=localhost) and during initial
# certbot bootstrap on the server (before Let's Encrypt cert is issued).
set -e
DOMAIN="${DOMAIN:-localhost}"
DIR="/etc/letsencrypt/live/$DOMAIN"
if [ ! -f "$DIR/fullchain.pem" ]; then
    echo "[init-ssl] No cert for $DOMAIN — generating self-signed..."
    # nginx:alpine ships libssl but no openssl CLI — install if missing.
    if ! command -v openssl >/dev/null 2>&1; then
        echo "[init-ssl] openssl CLI missing — installing via apk..."
        apk add --no-cache openssl >/dev/null
    fi
    mkdir -p "$DIR"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$DIR/privkey.pem" \
        -out    "$DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN/O=Stratchatella Demo" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN" 2>/dev/null
    echo "[init-ssl] Done."
else
    echo "[init-ssl] Found cert at $DIR — reusing."
fi
