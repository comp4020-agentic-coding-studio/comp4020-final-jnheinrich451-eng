# syntax = docker/dockerfile:1

# No runtime npm dependencies. Node's SQLite stores the world on the Fly volume.
FROM node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
COPY server.js README.md ./
COPY public/ ./public/
EXPOSE 8080
CMD ["node", "server.js"]
