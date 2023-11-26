const discordAuthorizeApi = 'https://discord.com/oauth2/authorize';
import { dirname } from 'path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
dotenv.config({
	path: `${dirname(fileURLToPath(import.meta.url))}/../../../.env`,
});

// https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
const scopes = ['identify'];

export function createAddBotToServerUrl() {
	const params = new URLSearchParams({
		client_id: process.env.CLIENT_ID,
		/* This is a bit flag constant derived with discord's application website. If we want more fancy things, we may want to adjust it to
		 * actually do the logic. Right now it has:
		 * - Manage Roles
		 * - Manage Channels
		 * - Read messages/View Channels
		 * - Send Messages
		 * - Create Public Threads
		 * - Create Private Threads
		 * - Send Messages in Threads
		 * - Manage Messages
		 * - Manage Threads
		 * - Read Message History
		 * - Add Reactions
		 * - Use Slash Commands
		 */
		permissions: '2147535872',
		// redirect_uri: window.location.origin,
		// response_type: 'code',
		scope: ['bot', ...scopes].join(' '),
	});
	return `${discordAuthorizeApi}?${params}`;
}

console.log(
	`Use the following URL to add freddie-bot to a server:\n\n${createAddBotToServerUrl()}`
);
