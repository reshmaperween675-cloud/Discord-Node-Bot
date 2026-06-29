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

# Install including devDeps so esbuild is available to compile lib/db.
# NODE_ENV is intentionally not set to production here.
RUN pnpm install --no-frozen-lockfile --filter "@workspace/discord-bot..."

# Compile lib/db TypeScript → JavaScript. After this step the pnpm workspace
# symlink for @workspace/db resolves to .js files, not .ts files, so tsx and
# Node can load them without any module-resolver workarounds.
RUN pnpm --filter "@workspace/db" run build

ENV NODE_ENV=production

COPY artifacts/discord-bot ./artifacts/discord-bot

EXPOSE 3000

CMD ["pnpm", "--filter", "@workspace/discord-bot", "run", "start"]
