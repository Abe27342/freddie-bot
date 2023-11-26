import { Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { dirname } from 'path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import * as commandsModule from '../dist/commands/index.js';
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

if (isProdDeploy) {
	await new Promise((resolve) => setTimeout(resolve, 10000));
	rest.put(Routes.applicationCommands(clientId), { body: commands });
} else {
	rest.put(Routes.applicationGuildCommands(clientId, guildId), {
		body: commands,
	})
		.then((data) =>
			console.log(
				`Successfully registered ${data.length} application commands.`
			)
		)
		.catch(console.error);
}
