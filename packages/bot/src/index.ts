import './register-env/index.js';
import { createClient } from './client.js';

const client = createClient({
	token: process.env.DISCORD_TOKEN,
	allowList: process.env.GUILD_ALLOW_LIST?.split(','),
	blockList: process.env.GUILD_BLOCK_LIST?.split(','),
});

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
