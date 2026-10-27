FROM ubuntu:22.04

ARG KEYCLOAK_VERSION=25.0.2
ARG NODE_VERSION=20

ENV DEBIAN_FRONTEND=noninteractive \
    JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
    PATH="/usr/lib/jvm/java-21-openjdk-amd64/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-21-jre-headless \
      curl \
      ca-certificates \
      openssl \
      supervisor \
      gnupg \
      python3 \
      build-essential \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libgtk-3-0 \
      libxss1 \
      libasound2 \
      libgbm1 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
      | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
      "https://github.com/keycloak/keycloak/releases/download/${KEYCLOAK_VERSION}/keycloak-${KEYCLOAK_VERSION}.tar.gz" \
      -o /tmp/keycloak.tar.gz \
    && tar -xzf /tmp/keycloak.tar.gz -C /opt \
    && mv /opt/keycloak-${KEYCLOAK_VERSION} /opt/keycloak \
    && rm /tmp/keycloak.tar.gz \
    && chmod +x /opt/keycloak/bin/kc.sh

WORKDIR /app
COPY app/package.json .
RUN npm install --omit=dev
COPY app/ .

RUN mkdir -p /opt/keycloak-template
COPY keycloak/realm-template.json /opt/keycloak-template/realm-template.json

COPY supervisord.conf /etc/supervisord.conf

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /var/log

EXPOSE 3000

ENV FLAG="GRT26{LALALALOLOLOPIPIPUPU}"

ENTRYPOINT ["/entrypoint.sh"]
