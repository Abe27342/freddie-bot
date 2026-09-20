import { Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { dirname } from 'path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import * as commandsModule from '../dist/commands/index.js';
import { createCustomCommandData } from '../dist/commands/custom.js';
import { createDb } from '../dist/db/index.js';
dotenv.config({
	path: `${dirname(fileURLToPath(import.meta.url))}/../../../.env`,
});

const {
	CLIENT_ID: clientId,
	LOCAL_TEST_SERVER_ID: guildId,
	DISCORD_TOKEN: token,
} = process.env;

const isProdDeploy = !!process.env.DEPLOY_EVERYWHERE;
console.log(
	isProdDeploy
		? 'Running a prod deployment'
		: `Running a test deployment to guild ${guildId}`
);

const commands = Object.values(commandsModule)
	.filter((command) => (isProdDeploy ? !command.testServerOnly : true))
	.map((command) => {
		if (command.adminOnly) {
			return command.data.setDefaultMemberPermissions('0');
		}
		return command.data;
	});
const rest = new REST({ version: '10' }).setToken(token);

console.log(
	`Registering the following ${commands.length} commands${
		isProdDeploy ? ' in 10 seconds' : ''
	}:`
);

for (const command of commands) {
	console.log(`- ${command.name}`);
}

const db = await createDb();
try {
	const customCommands = await db.getCustomCommands();
	const standardCommandNames = new Set(
		Object.values(commandsModule).map((command) => command.data.name)
	);
	for (const customCommand of customCommands) {
		if (standardCommandNames.has(customCommand.commandName)) {
			throw new Error(
				`Custom command "/${customCommand.commandName}" for guild ${customCommand.serverId} conflicts with a standard command.`
			);
		}
	}
	const configuredGuildIds = (process.env.CUSTOM_COMMAND_GUILD_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	const customGuildIds = new Set([
		...configuredGuildIds,
		...customCommands.map((command) => command.serverId),
	]);

	if (isProdDeploy) {
		const data = await rest.put(Routes.applicationCommands(clientId), {
			body: commands,
		});
		console.log(
			`Successfully registered ${data.length} global application commands.`
		);

		for (const customGuildId of customGuildIds) {
			const guildCommands = customCommands.filter(
				(command) => command.serverId === customGuildId
			);
			const body = guildCommands
				.sort((a, b) => a.commandName.localeCompare(b.commandName))
				.map(createCustomCommandData);
			const guildData = await rest.put(
				Routes.applicationGuildCommands(clientId, customGuildId),
				{ body }
			);
			console.log(
				`Successfully registered ${guildData.length} application commands for guild ${customGuildId}.`
			);
		}
	} else {
		const guildCustomCommands = customCommands.filter(
			(command) => command.serverId === guildId
		);
		const body = [
			...commands,
			...guildCustomCommands
				.sort((a, b) => a.commandName.localeCompare(b.commandName))
				.map(createCustomCommandData),
		];
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body }
		);
		console.log(
			`Successfully registered ${data.length} application commands.`
		);
	}
} finally {
	await db.close();
}
