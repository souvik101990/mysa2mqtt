################################################################################
# Builder stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies for building
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source code and build
COPY src ./src
COPY tsconfig.json .
COPY tsup.config.cjs .

RUN npm run build

################################################################################
# Final stage
FROM node:22-alpine AS final

ARG VERSION

# Metadata
LABEL maintainer="Pascal Bourque <pascal@cosmos.moi>"
LABEL description="Expose Mysa smart thermostats to home automation platforms via MQTT."
LABEL org.opencontainers.image.source="https://github.com/bourquep/mysa2mqtt"
LABEL org.opencontainers.image.description="Expose Mysa smart thermostats to home automation platforms via MQTT"
LABEL org.opencontainers.image.licenses="MIT"

# Install security updates
RUN apk --no-cache upgrade

# tini: proper PID 1 / signal handling for the supervisor wrapper below
RUN apk --no-cache add tini

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S mysa2mqtt -u 1001

# Copy package files and install production dependencies only
COPY --from=builder /app/package*.json ./
RUN npm version ${VERSION} --no-git-tag-version && \
  npm ci --only=production --ignore-scripts && \
  npm cache clean --force

# Patch mysa-js-sdk fanSpeedMaps for AC-V1-X devices (CodeNum=1117, fanSpeeds=[1,2,4,6])
# The SDK hardcodes universal fn values (low=3, medium=5, high=7, max=8) but CodeNum=1117
# devices use fn=2 (low), fn=4 (medium), fn=6 (high). Fix both the SEND and RECEIVE maps.
COPY patch-sdk.js /tmp/patch-sdk.js
RUN node /tmp/patch-sdk.js

# Copy built application
COPY --from=builder /app/dist ./dist

# Patch main.js: fix fan mode fallback for AC devices with missing fanSpeeds
COPY patch-main.js /tmp/patch-main.js
RUN node /tmp/patch-main.js

# Change ownership to non-root user
RUN chown -R mysa2mqtt:nodejs /app
USER mysa2mqtt

ENTRYPOINT ["/sbin/tini", "--", "/bin/sh", "-c", "while true; do echo \"[$(date -Iseconds)] mysa2mqtt-supervisor: starting\"; node /app/dist/main.js; rc=$?; echo \"[$(date -Iseconds)] mysa2mqtt-supervisor: exited rc=$rc, restart in 5s\"; sleep 5; done"]
