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
RUN node -e " \
  const fs = require('fs'); \
  const file = '/app/node_modules/mysa-js-sdk/dist/index.js'; \
  let content = fs.readFileSync(file, 'utf8'); \
  \
  // 1. Fix SEND map in setDeviceState: use fn=2/4/6 for low/medium/high \
  content = content.replace( \
    'const fanSpeedMap = { auto: 1, low: 3, medium: 5, high: 7, max: 8 }', \
    'const fanSpeedMap = { auto: 1, low: 2, medium: 4, high: 6 }' \
  ); \
  \
  // 2. Fix RECEIVE map in _processMqttMessage: add fn=2->low, fn=4->medium, fn=6->high \
  content = content.replace( \
    '1: \"auto\",\n              3: \"low\",', \
    '1: \"auto\",\n              2: \"low\",\n              3: \"low\",' \
  ); \
  content = content.replace( \
    '5: \"medium\",\n              7: \"high\",', \
    '4: \"medium\",\n              5: \"medium\",\n              6: \"high\",\n              7: \"high\",' \
  ); \
  \
  fs.writeFileSync(file, content); \
  console.log('SDK patched: SEND map low=2/medium=4/high=6; RECEIVE map added fn=2,4,6 entries'); \
"

# Copy built application
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R mysa2mqtt:nodejs /app
USER mysa2mqtt

ENTRYPOINT ["node", "dist/main.js"]
