FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY src/package.json .
RUN npm install --omit=dev

COPY src/ .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
