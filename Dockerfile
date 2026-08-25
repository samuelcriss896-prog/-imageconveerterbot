FROM node:18-alpine

# Install build dependencies for sharp
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    build-base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create temp directory
RUN mkdir -p temp

# Start the bot
CMD ["npm", "start"]
