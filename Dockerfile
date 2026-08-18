# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate the database client (Required for Prisma)
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Drop dev dependencies
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy built dependencies and code from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/src ./src
COPY --from=build /app/server.js ./server.js

# Ensure non-root node user permissions
RUN mkdir -p uploads && chown -R node:node /app

USER node

# Match the port your frontend Nginx proxy expects
EXPOSE 5000

# Execute entry point directly
CMD ["node", "server.js"]