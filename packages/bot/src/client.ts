// Require the necessary discord.js classes
import registerDebug from 'debug';
import { Client, Collection, GatewayIntentBits, Interaction } from 'discord.js';
import * as commandsModule from './commands/index.js';
// import * as interactionsModule from './interactions/index.js';
import type { Command } from './commands/types';
import type { InteractionHandler } from './interactions/types';
import { AsyncWorkTypes, ClientOptions, FreddieBotClient } from './types.js';
import { createReminderQueue } from './reminderTaskQueue.js';

const interactionsModule: { [key: string]: InteractionHandler } = {};

const debugTaskqueue = registerDebug('freddie-bot:taskqueue');

function getCommandsCollection(): Collection<string, Command> {
	const commands = new Collection<string, Command>();
	for (const commandImport of Object.values(commandsModule)) {
		commands.set(commandImport.data.name, commandImport);
	}
	return commands;
}

function getInteractionsCollection(): Collection<string, InteractionHandler> {
	const interactions = new Collection<string, InteractionHandler>();
	for (const interactionImport of Object.values(interactionsModule)) {
		interactions.set(interactionImport.name, interactionImport);
	}
	return interactions;
}

export async function createClient({
	token,
	allowList,
	blockList,
	baseClient,
	db,
	onError: onErrorArg,
}: ClientOptions): Promise<FreddieBotClient> {
	const client = (baseClient ??
		new Client({
			intents: [GatewayIntentBits.Guilds],
		})) as FreddieBotClient;
	const onError = onErrorArg ?? surfaceError;
	client.commands = getCommandsCollection();
	client.interactions = getInteractionsCollection();

	const remainingWork: Map<Promise<unknown>, string> = new Map();

	client.pushAsyncWork = (
		name: AsyncWorkTypes,
		work: Promise<unknown>,
		interaction?: Interaction
	): void => {
		debugTaskqueue(`pushing ${name}`);
		remainingWork.set(work, name);
		work.catch((error) => onError(error, name, interaction)).finally(() => {
			remainingWork.delete(work);
		});
	};

	client.ensurePendingWorkProcessed = async () => {
		while (remainingWork.size > 0) {
			if (debugTaskqueue.enabled) {
				debugTaskqueue(
					`awaiting ${remainingWork.size} promises: ${Array.from(
						remainingWork.values()
					).join(', ')}`
				);
			}
			await Promise.all(Array.from(remainingWork.keys()));
		}
	};

	// TODO: Tune.
	// Once every 6 hours.
	const queryInterval = 1000 * 60 * 60 * 6;
	const reminderQueue = createReminderQueue(client, db, { queryInterval });
	client.enqueueReminder = async (reminder) =>
		reminderQueue.setReminder(reminder);

	client.bosses = db;

	await Promise.all(
		client.commands.map((command) => command.initialize?.(client))
	);

	client.once('ready', async () => {
		console.log('Ready!');
	});

	const allowListSet = new Set(allowList);
	const blockListSet = new Set(blockList);
	function shouldProcessInteraction(guildId: string): boolean {
		if (allowListSet.size > 0) {
			return allowListSet.has(guildId);
		}
		return !blockListSet.has(guildId);
	}

	client.on('interactionCreate', (interaction) => {
		const interactionLocationId =
			interaction.guildId ?? interaction.channelId;
		if (shouldProcessInteraction(interactionLocationId)) {
			console.log(`Processing interaction for: ${interactionLocationId}`);
		} else {
			console.log(`Ignoring interaction for: ${interactionLocationId}`);
			return;
		}

		client.pushAsyncWork(
			'command',
			runInteraction(interaction),
			interaction
		);
	});

	async function runInteraction(interaction: Interaction): Promise<void> {
		const client = interaction.client as FreddieBotClient;
		if (interaction.isChatInputCommand()) {
			const handler = client.commands.get(interaction.commandName);
			await handler.execute(interaction);
		} else if (interaction.isStringSelectMenu() || interaction.isButton()) {
			const handler = client.interactions.get(interaction.customId);
			await handler.execute(interaction);
		} else if (interaction.isAutocomplete()) {
			const handler = client.commands.get(interaction.commandName);
			handler.autocomplete?.(interaction);
		}
	}

	client.login(token);
	return client;
}

async function surfaceError(
	error: Error,
	source: AsyncWorkTypes,
	interaction?: Interaction
): Promise<void> {
	console.error(`Error during ${source}: ${error}`);
	try {
		if (interaction?.isRepliable() && !interaction.replied) {
			await interaction.reply({
				content: `There was an error while executing this ${source}!`,
				ephemeral: true,
			});
		}
	} catch (err) {
		console.log('Failed to notify user of above error:', err, source);
	}
}
