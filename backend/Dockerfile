# ==========================================
# STAGE 1: Build Environment
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for efficient docker layer caching
COPY package*.json ./
RUN npm install

# Copy code configuration and source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to production JavaScript in dist/
RUN npm run build

# ==========================================
# STAGE 2: Production Execution Environment
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set container environment variables
ENV NODE_ENV=production

# Install only production dependencies to minimize container footprint
COPY package*.json ./
RUN npm install --only=production

# Copy compiled files from stage 1 builder
COPY --from=builder /app/dist ./dist

# GCP Cloud Run automatically injects the PORT env variable (usually 8080)
# and requires the container to bind to all network interfaces (0.0.0.0)
EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/index.js"]
