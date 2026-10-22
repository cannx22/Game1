# Civciv Kıyameti oyun sunucusu (Coolify / Docker)
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=4747

# only runtime dependencies; the desktop app (Electron) is not needed on the server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY server ./server
COPY shared ./shared
COPY client ./client

USER node
EXPOSE 4747
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4747/health || exit 1

CMD ["node", "server/index.js"]
