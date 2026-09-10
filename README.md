# Freddie Bot

This repository hosts packages for Freddie bot, a MapleLegends utility bot.

It uses [pnpm](https://pnpm.io/).

## Setup

1. Install [node 18](https://nodejs.org/en/download/) or later. I recommend using [nvm](https://github.com/nvm-sh/nvm) ([windows link](https://github.com/coreybutler/nvm-windows)) to manage node versions.
2. Enable corepack: `corepack enable`
3. Install repo dependencies: `pnpm i`
4. Build: `npm run build`

## TODO

TODO:

-   random extra pqs (lmpq?)
-   fix $maple to be more aesthetic
-   testing
-   Avoid using env for secrets with docker setup, mount secret volumes instead
