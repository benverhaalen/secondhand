FROM node:24.10.0-bookworm-slim

WORKDIR /srv/secondhand
COPY app/package.json app/package-lock.json ./app/
# playwright-core is a devDependency. Browser composition may fail at use;
# keeping it out of this image must not make the ordinary server boot fail.
RUN cd app && npm ci --omit=dev --ignore-scripts

COPY . .
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "server/main.ts"]
