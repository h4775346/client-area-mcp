# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY sas4-license-mcp-server.js ./

# Expose port
EXPOSE 3000

# Set environment variable for port (optional, defaults to 3000)
ENV PORT=3000

# Run the application
CMD ["node", "sas4-license-mcp-server.js"]

