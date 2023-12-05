import './register-env/index.js';
import { createClient } from './client.js';
import { createDb } from './db/index.js';

// Error Handling
process.on('uncaughtException', (err) => {
	console.log('Uncaught Exception: ' + err);
	console.log(err);
});

process.on('unhandledRejection', (reason, promise) => {
	console.log(
		'[FATAL] Possibly Unhandled Rejection at: Promise ',
		promise,
		' reason: ',
		(reason as any).message
	);
});

await createClient({
	token: process.env.DISCORD_TOKEN,
	allowList: process.env.GUILD_ALLOW_LIST?.split(','),
	blockList: process.env.GUILD_BLOCK_LIST?.split(','),
	db: await createDb(),
});
