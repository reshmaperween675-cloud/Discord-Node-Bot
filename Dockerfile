FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

WORKDIR /app

ENV PNPM_HOME=/usr/local/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

COPY artifacts/discord-bot/package.json    ./artifacts/discord-bot/
COPY artifacts/api-server/package.json     ./artifacts/api-server/
COPY artifacts/control-center/package.json ./artifacts/control-center/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json     ./lib/api-client-react/
COPY lib/api-spec/package.json             ./lib/api-spec/
COPY lib/api-zod/package.json              ./lib/api-zod/
COPY lib/db/package.json                   ./lib/db/
COPY scripts/package.json                  ./scripts/

# Install deps for bot + api-server + control-center (including devDeps for esbuild/vite).
RUN pnpm install --frozen-lockfile \
    --filter "@workspace/discord-bot..." \
    --filter "@workspace/api-server..." \
    --filter "@workspace/control-center..."

# Copy source after install so package.json changes don't bust the install cache.
COPY lib/db              ./lib/db
COPY lib/api-zod         ./lib/api-zod
COPY lib/api-client-react ./lib/api-client-react
COPY artifacts/discord-bot     ./artifacts/discord-bot
COPY artifacts/api-server      ./artifacts/api-server
COPY artifacts/control-center  ./artifacts/control-center

# Build Discord bot (esbuild — bundles everything into dist/index.mjs)
RUN pnpm --filter @workspace/discord-bot run build

# Build API server (esbuild — bundles everything into dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build

# Build Control Center React app (Vite — outputs static files to dist/public/)
# PORT is required by vite.config.ts at build time but doesn't affect the output.
RUN PORT=3000 BASE_PATH=/dashboard pnpm --filter @workspace/control-center run build

ENV NODE_ENV=production
# Where the api-server should find the pre-built Control Center static files.
ENV CONTROL_CENTER_STATIC=/app/artifacts/control-center/dist/public

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000

CMD ["/bin/sh", "/app/start.sh"]
