# Stage 1: Build Frontend and Backend
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm install

# Copy source files
COPY client ./client
COPY server ./server

# Build both client and server
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=2567

COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm install --omit=dev --workspace=server

# Copy build artifacts
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist

EXPOSE 2567

CMD ["npm", "start", "--workspace", "server"]
