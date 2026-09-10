# Freddie Bot

This repository hosts packages for Freddie bot, a MapleLegends utility bot.

It uses [pnpm](https://pnpm.io/).

## Setup

1. Install [node 18](https://nodejs.org/en/download/) or later. I recommend using [nvm](https://github.com/nvm-sh/nvm) ([windows link](https://github.com/coreybutler/nvm-windows)) to manage node versions.
2. Enable corepack: `corepack enable`
3. Install repo dependencies: `pnpm i`
4. Build: `npm run build`

## Boss timer storage

Boss timers remain available for seven days after their expiration so commands
can show recent spawn history. Reads exclude older timers, and startup only
loads timers whose reminders have not been sent. Display queries are scoped to
the requested boss and Discord channel.

After Discord is ready, the bot removes up to 20 stale or incomplete timer
documents per pass. Passes wait one second after completion while a backlog
remains, then run again after an hour. Failures use the bot's normal error
reporting and retry with exponential backoff from five seconds up to one minute. These limits
reduce bursts on low-throughput Cosmos DB accounts but do not guarantee a fixed
RU cost. Existing backlogs drain without blocking Discord login.

The bot creates indexes on expiration, name, and Discord channel/name/expiration
when connecting to the database; its database account must have permission to
create indexes. The initial index build may take time on a large collection.

## TODO

TODO:

-   random extra pqs (lmpq?)
-   fix $maple to be more aesthetic
-   testing
-   Avoid using env for secrets with docker setup, mount secret volumes instead
