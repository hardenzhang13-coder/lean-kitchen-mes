# syntax=docker/dockerfile:1

# ---- 依赖安装 ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- 构建 ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建期环境变量仅用于通过启动校验，不会进入运行时镜像
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    SESSION_SECRET="build-time-placeholder-secret-32chars!" \
    QWEN_API_KEY="build-placeholder" \
    QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1" \
    QWEN_MODEL="qwen-vl-max" \
    CLOUDINARY_CLOUD_NAME="build-placeholder" \
    CLOUDINARY_UPLOAD_PRESET="build-placeholder"
RUN npm run build

# ---- 数据库迁移/种子（含 prisma CLI 与完整依赖） ----
FROM builder AS migrate
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
