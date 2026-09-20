# README

## deploy-commands.js

This script should be run whenever FreddieBot's set of supported commands is updated.
It can be run with `npm run update-commands` from the root or using the "Deploy commands" VSCode launch target.

Ordinary commands are deployed globally in production. Custom command records from
the `custom-commands` MongoDB collection are grouped by `serverId` and deployed as
guild-specific top-level commands. Responses remain in MongoDB and are loaded
when a custom command is invoked.

Set `CUSTOM_COMMAND_GUILD_IDS` to the comma-separated list of guilds managed this
way. Database guilds are included automatically, but retaining a guild in this
setting after deleting its last record allows the script to remove its stale
guild commands. A custom command cannot use the same name as a standard command.

Each document has this shape:

```json
{
	"commandName": "account-help",
	"serverId": "123456789012345678",
	"response": "Response text stored only in MongoDB"
}
```

`commandName` must be unique within a server. After changing these records, run
the deployment script so Discord's guild command schema matches the database.

## custom-commands.js

Maintain a server's custom commands in a natural JSON object:

```json
{
	"account-help": "Account support response",
	"technical-help": "Technical support response"
}
```

Synchronize that complete file to MongoDB:

```console
pnpm --filter @freddie-bot/bot custom-commands sync <server-id> <above-json-filepath>
```

This creates or updates entries from the file and deletes entries missing from
the file for that server only. It does not change commands belonging to other
servers. Invalid JSON, non-string responses, invalid Discord command names, and
conflicts with standard commands are rejected before the database is opened.
Responses must contain 1-2000 characters, and each server can have at most 80
custom commands.

Export a server's current entries back to the same representation:

```console
pnpm --filter @freddie-bot/bot custom-commands export <server-id> <above-json-filepath>
```

The file argument defaults to `data.json`, which is ignored by Git.

## print-authorize-link.js

This script can be used to generate a FreddieBot share-link for adding him to servers.
