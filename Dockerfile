FROM node:18

WORKDIR /usr/src/app

RUN corepack enable

# Files required by pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm fetch

# Bundle remaining app source
COPY . .

RUN pnpm install --frozen-lockfile -r --offline

RUN npm run build

COPY assets /assets/

CMD npm run start:bot
