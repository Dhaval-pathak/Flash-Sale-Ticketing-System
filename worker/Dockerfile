FROM node:20-alpine
WORKDIR /usr/src/app/worker
COPY worker/package.json worker/package-lock.json* ./
RUN npm install
COPY worker/index.ts ./index.ts
COPY api/src /usr/src/app/api/src
CMD ["npm", "start"]
