FROM debian:bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    tor \
    python3 \
    python3-flask \
    wkhtmltopdf \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# WiFi config - the target file
RUN mkdir -p /etc/wpa_supplicant
COPY wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf

# Flask app
COPY app/ /app/

# Tor
COPY torrc /etc/tor/torrc
RUN mkdir -p /var/lib/tor/hidden_service \
    && chown -R debian-tor:debian-tor /var/lib/tor \
    && chmod 700 /var/lib/tor/hidden_service

# Supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# After first boot, read the .onion address with:
#   docker exec <container> cat /var/lib/tor/hidden_service/hostname

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
