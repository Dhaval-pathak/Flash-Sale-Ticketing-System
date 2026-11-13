FROM node:20-alpine
WORKDIR /usr/src/app/worker
COPY worker/package.json worker/package-lock.json* ./
RUN npm install
COPY worker ./
COPY api/src /usr/src/app/api/src
ENV NODE_PATH=/usr/src/app/worker/node_modules
RUN ln -s /usr/src/app/worker/node_modules /usr/src/app/node_modules
CMD ["npm", "start"]
