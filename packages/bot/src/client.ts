// Require the necessary discord.js classes
import registerDebug from 'debug';
import { Client, Collection, GatewayIntentBits, Interaction } from 'discord.js';
import * as commandsModule from './commands/index.js';
// import * as interactionsModule from './interactions/index.js';
import type { Command } from './commands/types';
import type { InteractionHandler } from './interactions/types';

const interactionsModule: { [key: string]: InteractionHandler } = {};

const debugTaskqueue = registerDebug('freddie-bot:taskqueue');

export type AsyncWorkTypes = 'command';

export interface FreddieBotClient extends Client<boolean> {
	commands: Collection<string, Command>;
	interactions: Collection<string, InteractionHandler>;

	/**
	 * Pushes a set of asynchronous work onto the client.
	 * Errors will be surfaced as determined by {@link ClientOptions.onError}.
	 */
	pushAsyncWork(
		name: AsyncWorkTypes,
		work: Promise<unknown>,
		interaction?: Interaction
	): void;

	/**
	 * Ensures all pending interactions/commands have been processed.
	 *
	 * This is immediately useful for tests, but may also be useful in the future for production in cases like:
	 * - Graceful shutdown
	 * - Avoiding interleaving of synchronization between fluid file and discord: there are likely race conditions
	 *   in the current logic that are rare enough to not have yet caused issues.
	 *
	 * TODO: maybe want a variant with allSettled instead of 'all'
	 */
	ensurePendingWorkProcessed(): Promise<void>;
}

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

export interface ClientOptions {
	/**
	 * Discord token to use for login.
	 */
	token: string;

	/**
	 * List of server IDs that the bot should process interactions on.
	 * If undefined, the bot will process interactions on all servers it is a member of.
	 */
	allowList?: string[];

	/**
	 * List of server IDs that the bot should ignore interactions on.
	 */
	blockList?: string[];

	/**
	 * Optional base discord client to use rather than initializing a new one.
	 *
	 * This is primarily useful for tests to set up mocks.
	 */
	baseClient?: Client;

	/**
	 * Policy to apply when errors are encountered in interactions or events.
	 *
	 * By default, errors are logged to the console and the user is notified of the error
	 * when the user was performing an interaction.
	 * @returns
	 */
	onError?: (
		error: Error,
		source: AsyncWorkTypes,
		interaction?: Interaction
	) => Promise<void>;
}

export function createClient({
	token,
	allowList,
	blockList,
	baseClient,
	onError: onErrorArg,
}: ClientOptions): FreddieBotClient {
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
		if (shouldProcessInteraction(interaction.guild.id)) {
			console.log(
				`Processing interaction for guild: ${interaction.guild.id}`
			);
		} else {
			console.log(
				`Ignoring interaction for guild: ${interaction.guild.id}`
			);
			return;
		}

		client.pushAsyncWork(
			'command',
			// TODO: Handle DMs.
			runInteraction(interaction),
			interaction
		);
	});

	async function runInteraction(interaction: Interaction): Promise<void> {
		const client = interaction.client as FreddieBotClient;
		let handler: {
			execute: (interaction: Interaction) => Promise<void>;
			requiresSerializedContext?: boolean;
		};
		if (interaction.isChatInputCommand()) {
			handler = client.commands.get(interaction.commandName);
		} else if (interaction.isSelectMenu() || interaction.isButton()) {
			handler = client.interactions.get(interaction.customId);
		} else {
			return;
		}

		await handler.execute(interaction);
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
