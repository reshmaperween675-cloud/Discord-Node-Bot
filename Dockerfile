FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

WORKDIR /app

ENV PNPM_HOME=/usr/local/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

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

RUN pnpm install --no-frozen-lockfile --filter "@workspace/discord-bot..."

# pnpm creates a symlink: artifacts/discord-bot/node_modules/@workspace/db -> lib/db
# tsx (TypeScript runner) resolves the exports map correctly, but then does a
# TypeScript source lookup using the *symlink* path instead of the real path,
# constructing a path like:
#   /app/artifacts/discord-bot/node_modules/@workspace/db/src/schema/index.ts
# That file doesn't exist at the symlink location (the real file is under lib/db/),
# so tsx crashes with ERR_MODULE_NOT_FOUND.
#
# Fix: replace the symlink with a real copy so every sub-path resolves correctly.
RUN cp -rL artifacts/discord-bot/node_modules/@workspace/db /tmp/db-pkg && \
    rm -rf artifacts/discord-bot/node_modules/@workspace/db && \
    mv /tmp/db-pkg artifacts/discord-bot/node_modules/@workspace/db

COPY artifacts/discord-bot ./artifacts/discord-bot

EXPOSE 3000

CMD ["pnpm", "--filter", "@workspace/discord-bot", "run", "start"]
