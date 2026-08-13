# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:24.19.0-alpine3.24

FROM ${NODE_IMAGE} AS dependencies

WORKDIR /app/server

COPY server/package*.json ./

# 依赖只在构建阶段安装；生产镜像不保留 npm、npx 或 Corepack。
RUN npm ci --omit=dev --ignore-scripts \
    && mkdir -p node_modules \
    && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime

LABEL org.opencontainers.image.title="数智心港湾后端" \
      org.opencontainers.image.description="大学生心理健康小程序后端服务"

WORKDIR /app/server

COPY --from=dependencies --chown=node:node /app/server/node_modules ./node_modules
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/scripts ./scripts

COPY --chown=node:node utils/scoring-engine.js /app/utils/scoring-engine.js

RUN mkdir -p /app/data \
    && chown -R node:node /app \
    && rm -rf /usr/local/lib/node_modules/npm \
              /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm \
              /usr/local/bin/npx \
              /usr/local/bin/corepack

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 8787

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

STOPSIGNAL SIGTERM

CMD ["node", "src/index.js"]
