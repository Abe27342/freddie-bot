# Freddie Bot

This repository hosts packages for Freddie bot, a MapleLegends utility bot.

It uses [pnpm](https://pnpm.io/).

## Setup

1. Install [node 18](https://nodejs.org/en/download/) or later. I recommend using [nvm](https://github.com/nvm-sh/nvm) ([windows link](https://github.com/coreybutler/nvm-windows)) to manage node versions.
2. Enable corepack: `corepack enable`
3. Install repo dependencies: `pnpm i`
4. Build: `npm run build`

## Boss timer storage

Boss timers use Azure Cosmos DB for MongoDB's native time-to-live (TTL) feature.
The bot creates a TTL index on the internal `_ts` field with
`expireAfterSeconds: 604800`, so documents expire seven days after their last
modification, not seven days after the boss spawn time in `expiration`.
Marking a reminder as sent updates the document and restarts that seven-day
period. No per-document `ttl` field is needed.

Cosmos DB handles expiration in the background; the bot does not run an
age-based cleanup worker or bulk-delete old timers on startup. For provisioned
throughput accounts, physical TTL deletion uses spare RUs and can be delayed
when capacity is unavailable. The policy also applies to existing documents:
enabling it makes documents last modified more than seven days ago eligible
for expiration. Duplicate compaction is not part of this policy.

Startup loads only timers whose reminders have not been sent. Display queries
are scoped to the requested boss and Discord channel, with separate single-field
indexes on `name` and `channelId`. Reads exclude records missing a name or
expiration but otherwise rely on Cosmos DB for TTL visibility.

The database account must have permission to create indexes. Cosmos DB builds
indexes in the background; a new index is usable once its build completes.
The `_ts` TTL configuration is Cosmos DB-specific, not a portable TTL policy
for a standard MongoDB server.

## TODO

TODO:

-   random extra pqs (lmpq?)
-   fix $maple to be more aesthetic
-   testing
-   Avoid using env for secrets with docker setup, mount secret volumes instead
