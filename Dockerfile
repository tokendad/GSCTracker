FROM node:18-alpine

# Install shadow package for usermod/groupmod support and su-exec
RUN apk add --no-cache shadow su-exec

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Create public directory
RUN mkdir -p /app/public

# Copy server and static files
COPY server.js ./
COPY index.html ./public/
COPY styles.css ./public/
COPY script.js ./public/

# Create entrypoint script to handle PUID, PGID, and UMASK
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory
RUN mkdir -p /data

# Create logs directory
RUN mkdir -p /data/logs

# Expose port
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
