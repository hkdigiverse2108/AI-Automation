# --- Build Stage ---
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# --- Production Stage ---
FROM node:18-alpine
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# Copy source files
COPY . .
# Copy node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Expose port and start
EXPOSE 5000
CMD ["npm", "start"]
