FROM node:20-alpine

# Install OpenSSL for Prisma engine on Alpine
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && npm start"]
