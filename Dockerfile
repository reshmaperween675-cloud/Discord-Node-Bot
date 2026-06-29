FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

WORKDIR /app

ENV PNPM_HOME=/usr/local/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

COPY artifacts/discord-bot/package.json ./artifacts/discord-bot/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY scripts/package.json ./scripts/

COPY lib/db ./lib/db
COPY artifacts/discord-bot ./artifacts/discord-bot

# Install all workspace deps (including @workspace/db) so pnpm deploy can bundle them.
# NODE_ENV is intentionally unset here so devDependencies are available during install.
RUN pnpm install --no-frozen-lockfile --filter "@workspace/discord-bot..."

# `pnpm deploy` produces a self-contained directory where every workspace
# dependency (@workspace/db etc.) is COPIED as a real folder — no symlinks.
# This permanently eliminates the tsx symlink/TypeScript-source-lookup bug that
# caused ERR_MODULE_NOT_FOUND on @workspace/db/src/schema/index.ts.
RUN pnpm deploy --filter @workspace/discord-bot /deploy

ENV NODE_ENV=production
WORKDIR /deploy

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "src/index.ts"]
