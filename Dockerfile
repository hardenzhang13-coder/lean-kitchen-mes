# syntax=docker/dockerfile:1

# ---- 依赖安装 ----
FROM node:24-alpine AS deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
# Prisma 引擎二进制走 npmmirror 镜像源（官方 binaries.prisma.sh 在大陆线路不稳定）
ENV PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR}"
COPY package.json package-lock.json* ./
# 大陆服务器走 npmmirror，npm ci 从 ~15min 降到 ~2min
RUN --mount=type=cache,target=/root/.npm \
    npm ci --registry="${NPM_REGISTRY}"

# ---- 构建 ----
FROM node:24-alpine AS builder
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ENV PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR}"
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建期环境变量仅用于通过启动校验，不会进入运行时镜像
ENV DATABASE_URL="mysql://build:build@localhost:3306/build" \
    SESSION_SECRET="build-time-placeholder-secret-32chars!" \
    QWEN_API_KEY="build-placeholder" \
    QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1" \
    QWEN_MODEL="qwen-vl-max" \
    CLOUDINARY_CLOUD_NAME="build-placeholder" \
    CLOUDINARY_UPLOAD_PRESET="build-placeholder"
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---- 数据库迁移/种子（只安装依赖并生成 Prisma Client，不构建 Next.js） ----
FROM deps AS migrate
WORKDIR /app
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ---- 运行时（standalone，最小镜像） ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
