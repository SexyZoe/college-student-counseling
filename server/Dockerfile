FROM node:22-bookworm-slim

LABEL org.opencontainers.image.title="数智心港湾后端" \
      org.opencontainers.image.description="大学生心理健康小程序后端服务"

WORKDIR /app/server

COPY server/package*.json ./

RUN npm ci --omit=dev

COPY --chown=node:node server/src ./src
COPY --chown=node:node server/scripts ./scripts

COPY --chown=node:node utils/scoring-engine.js /app/utils/scoring-engine.js

RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 8787

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

STOPSIGNAL SIGTERM

CMD ["npm", "start"]
