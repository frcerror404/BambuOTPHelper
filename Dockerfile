FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json .npmrc* ./
COPY src ./src
COPY public ./public
RUN npm install --prefer-offline --no-audit --progress=false \
  && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/main.js"]
