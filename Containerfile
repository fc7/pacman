FROM registry.access.redhat.com/ubi9/nodejs-18-minimal
WORKDIR /usr/src/app
COPY --chown=1001:1001 src src
COPY --chown=1001:1001 public public
COPY --chown=1001:1001 views views
COPY --chown=1001:1001 package*.json ./
RUN npm install --omit dev

ENV NODE_ENV=production
EXPOSE 8080

CMD ["npm", "start"]
