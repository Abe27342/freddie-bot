import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import * as commandsModule from '../dist/commands/index.js';
import { createCustomCommandData } from '../dist/commands/custom.js';
import {
	createCustomCommandConfig,
	createCustomCommands,
	parseCustomCommandConfig,
} from '../dist/customCommandConfig.js';
import { createDb } from '../dist/db/index.js';

dotenv.config({
	path: `${dirname(fileURLToPath(import.meta.url))}/../../../.env`,
});

const [operation, serverId, fileArgument = 'data.json'] = process.argv.slice(2);
const usage = 'Usage: custom-commands <sync|export> <server-id> [JSON file]';

if (!['sync', 'export'].includes(operation) || !serverId) {
	throw new Error(usage);
}
if (!/^\d{17,20}$/.test(serverId)) {
	throw new Error(`Invalid Discord server ID "${serverId}". ${usage}`);
}

const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
const filePath = resolve(invocationDirectory, fileArgument);

let replacements;
if (operation === 'sync') {
	const config = parseCustomCommandConfig(
		await readFile(filePath, { encoding: 'utf8' })
	);
	replacements = createCustomCommands(serverId, config);

	const standardCommands = Object.values(commandsModule);
	const standardCommandNames = new Set(
		standardCommands.map((command) => command.data.name)
	);
	for (const command of replacements) {
		createCustomCommandData(command).toJSON();
		if (standardCommandNames.has(command.commandName)) {
			throw new Error(
				`Custom command "/${command.commandName}" conflicts with a standard command.`
			);
		}
	}
}

const db = await createDb();
try {
	if (operation === 'sync') {
		await db.replaceCustomCommands(serverId, replacements);
		console.log(
			`Synchronized ${replacements.length} custom commands for server ${serverId}.`
		);
	} else {
		const commands = await db.getCustomCommands(serverId);
		const config = createCustomCommandConfig(commands);
		await writeFile(filePath, `${JSON.stringify(config, null, 4)}\n`, {
			encoding: 'utf8',
		});
		console.log(
			`Exported ${commands.length} custom commands for server ${serverId} to ${filePath}.`
		);
	}
} finally {
	await db.close();
}
