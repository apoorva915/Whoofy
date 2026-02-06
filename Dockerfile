## Production web image (Next.js) - multi-stage
FROM node:20-bullseye AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bullseye AS builder
WORKDIR /app

ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure public exists (Next.js standalone expects it)
RUN mkdir -p public

# Generate Prisma client from schema (deps stage has no schema)
RUN npx prisma generate

# Dummy DATABASE_URL so Next.js build (page data collection) passes env validation
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

RUN npm run build

# Standalone runner
FROM node:20-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install OpenSSL and FFmpeg/FFprobe for Prisma + video processing
RUN apt-get update -y && apt-get install -y openssl ffmpeg && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 10001 nextjs && \
    mkdir -p /app/storage && \
    chown -R nextjs:nextjs /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Next standalone provides server.js at root
CMD ["node", "server.js"]

