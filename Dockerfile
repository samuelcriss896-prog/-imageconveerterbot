FROM node:18-alpine

# Install build dependencies for sharp
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    build-base \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with specific flags
RUN npm ci --only=production --no-audit --no-fund

# Copy source code
COPY . .

# Create temp directory with proper permissions
RUN mkdir -p temp && chmod 755 temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the bot
CMD ["npm", "start"]
