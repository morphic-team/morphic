# Build stage
FROM node:22.16.0-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with BuildKit cache mount
# This caches npm's download cache between builds while keeping npm ci's guarantees
RUN --mount=type=cache,target=/root/.npm \
    npm ci --cache /root/.npm

# Install Angular CLI globally
RUN npm install -g @angular/cli

# Copy source code
COPY . .

# Copy changelog files from changelogs context (after source to avoid overwriting)
COPY --from=changelogs CHANGELOG.md ./MAIN_CHANGELOG.md
COPY --from=changelogs service/CHANGELOG.md ./SERVICE_CHANGELOG.md
COPY --from=changelogs browser-extension/CHANGELOG.md ./EXTENSION_CHANGELOG.md
COPY --from=changelogs USER_CHANGELOG.md ./USER_CHANGELOG.md

# Set explicit changelog paths for build script
ENV MAIN_CHANGELOG_PATH=./MAIN_CHANGELOG.md
ENV SERVICE_CHANGELOG_PATH=./SERVICE_CHANGELOG.md  
ENV EXTENSION_CHANGELOG_PATH=./EXTENSION_CHANGELOG.md
ENV USER_CHANGELOG_PATH=./USER_CHANGELOG.md

# Build Angular app for production
RUN npm run build -- --configuration=production

# Runtime stage
FROM nginx:alpine

# Remove default site config and add our own
RUN rm /etc/nginx/conf.d/default.conf
COPY angular-site.conf /etc/nginx/conf.d/

# Copy built app from builder stage
COPY --from=builder /app/dist/morphic-website/browser /usr/share/nginx/html

# Set ownership for nginx user (user already exists in nginx:alpine)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to nginx user
USER nginx

# Expose port 8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

