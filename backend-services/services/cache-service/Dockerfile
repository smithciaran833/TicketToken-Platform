FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S cache && \
    adduser -S cache -u 1001

USER cache

EXPOSE 3030

CMD ["npm", "start"]
