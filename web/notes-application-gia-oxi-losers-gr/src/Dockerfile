FROM node:25-slim

WORKDIR /home/node/

RUN apt-get update && \
    apt-get install -y firefox-esr curl && \
    rm -rf /var/lib/apt/lists/*

RUN chown -R node:node /home/node/

COPY --chown=node:node ./app/package*.json ./

USER node
RUN npm install

COPY --chown=node:node app/ .

USER root
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "start"]
