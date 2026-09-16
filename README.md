# Freddie Bot

This repository hosts packages for Freddie bot, a MapleLegends utility bot.

It uses [pnpm](https://pnpm.io/).

## Setup

1. Install Node 22.22.2 or later from the Node 22 LTS line. I recommend using [nvm](https://github.com/nvm-sh/nvm) ([Windows link](https://github.com/coreybutler/nvm-windows)) to manage Node versions.
2. Enable corepack: `corepack enable`
3. Install repo dependencies: `pnpm i`
4. Build: `npm run build`

## TODO

TODO:

-   random extra pqs (lmpq?)
-   fix $maple to be more aesthetic
-   testing
-   Avoid using env for secrets with docker setup, mount secret volumes instead
