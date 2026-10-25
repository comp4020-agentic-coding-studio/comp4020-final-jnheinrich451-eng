# syntax = docker/dockerfile:1

# Node's SQLite stores saves/accounts; Nodemailer provides SMTP delivery.
FROM node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
RUN npm install --global pnpm@11.9.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY server.js world-maintenance.js observability.js action-narration.js communication.js README.md ./
COPY accounts/ ./accounts/
COPY campaigns/ ./campaigns/
COPY public/ ./public/
EXPOSE 8080
CMD ["node", "server.js"]
