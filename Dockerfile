# Stage 1 — builder (Debian-based: Rolldown/Vite 8 native binaries require glibc, not musl)
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2 — production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
EXPOSE 5000
CMD ["npm", "start"]
