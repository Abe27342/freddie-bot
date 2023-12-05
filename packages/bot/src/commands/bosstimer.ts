import {
	AutocompleteInteraction,
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { FreddieBotClient } from '../types';
import { assert } from '../utils/index.js';

// Could be more restrictive here if we wanted.
type Boss = string;

const NAME_ARG = 'name';
const CHANNEL_ARG = 'channel';

const ML_CHANNELS = 6;
const RESPAWN_VARIANCE = 0.1;
const DISCORD_CHOICE_API_LIMIT = 25;

const msPer = {
	second: 1000,
	minute: 60 * 1000,
	hour: 60 * 60 * 1000,
};

// Note: more than 25 bosses are supported, but the discord API caps choices at 25. So we implement autocomplete
// to keep the experience ok.
const bosses = new Map<Boss, number>([
	['anego', 8 * msPer.hour],
	['samurai', 11 * msPer.hour],
	['mano', 1 * msPer.hour],
	['faust', 2 * msPer.hour],
	['clang', 2 * msPer.hour],
	['timer', 2 * msPer.hour],
	['mushmom', 2 * msPer.hour],
	['dyle', 2 * msPer.hour],
	['zmushmom', 2 * msPer.hour],
	['fox', 3 * msPer.hour],
	['taeroon', 3 * msPer.hour],
	['sagecat', 3 * msPer.hour],
	['eliza', 3 * msPer.hour],
	['snowman', 3 * msPer.hour],
	['manon', 1.5 * msPer.hour],
	['griffey', 1.5 * msPer.hour],
	['pianusl', 36 * msPer.hour],
	['pianusr', 24 * msPer.hour],
	['stumpy', 1 * msPer.hour],
	['balrog', 3 * msPer.hour],
	['deo', 1 * msPer.hour],
	['seruf', 1 * msPer.hour],
	['zeno', 2 * msPer.hour],
	['kimera', 3 * msPer.hour],
	['levi', 4 * msPer.hour],
	['dodo', 4 * msPer.hour],
	['lilynouch', 4 * msPer.hour],
	['lyka', 4 * msPer.hour],
	// TODO: Add bigfoot, make it intuitive. Different maps have different spawns.
	// ['bigfoot', 1],
	['crow', 23 * msPer.hour],
	['spirit', 12 * msPer.hour],
	['shade', 3 * msPer.hour],
	['dummy', 3 * msPer.hour],
	['riche', 3 * msPer.hour],
	['witch', 3 * msPer.hour],
	['camera', 3 * msPer.hour],
	['scholar', 3 * msPer.hour],
	['rurumo', 40 * msPer.minute],
	['deetnroi', 40 * msPer.minute],
]);
const bossNames = Array.from(bosses.keys());

export const bosstimer: Command = {
	data: new SlashCommandBuilder()
		.setName('bosstimer')
		.addSubcommand((builder) =>
			builder
				.setName('add')
				.setDescription('Add a timer for a boss.')
				.addStringOption((builder) =>
					builder
						.setName(NAME_ARG)
						.setDescription(
							'Name of the boss to set a timer for. Not all choices are shown. Type for autocomplete.'
						)
						.setAutocomplete(true)
						.setRequired(true)
				)
				.addStringOption((builder) =>
					builder
						.setName(CHANNEL_ARG)
						.setDescription(
							'Space-separated list of channels to add timers to. "all" is shorthand for all channels.'
						)
						.setRequired(true)
				)
		)
		.addSubcommand((builder) =>
			builder
				.setName('show')
				.setDescription('Show existing timers for a boss.')
				.addStringOption((builder) =>
					builder
						.setName(NAME_ARG)
						.setDescription('Name of the boss to show timers for.')
						.setAutocomplete(true)
						.setRequired(true)
				)
		)
		.addSubcommand((builder) =>
			builder
				.setName('delete')
				.setDescription('Delete an existing timer for a boss.')
				.addStringOption((builder) =>
					builder
						.setName(NAME_ARG)
						.setDescription(
							'Name of the boss to remove the timer for.'
						)
						.setAutocomplete(true)
						.setRequired(true)
				)
				.addStringOption((builder) =>
					builder
						.setName(CHANNEL_ARG)
						.setDescription(
							'Space-separated list of channels to remove timers from. "all" is shorthand for all channels.'
						)
						.setRequired(true)
				)
		)
		.setDescription(
			"Set, modify, or show reminder timers for boss's spawn."
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case 'add': {
				await addBossTimer(interaction);
				break;
			}
			case 'show': {
				await showBossTimers(interaction);
				break;
			}
			case 'delete': {
				await deleteBossTimer(interaction);
				break;
			}
			default: {
				throw new Error(`Invalid subcommand: ${subcommand}`);
			}
		}
	},

	async autocomplete(
		interaction: AutocompleteInteraction<CacheType>
	): Promise<void> {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name === NAME_ARG) {
			const choices = bossNames.filter((choice) =>
				choice.startsWith(focusedOption.value.toLowerCase())
			);
			if (choices.length > DISCORD_CHOICE_API_LIMIT) {
				choices.splice(
					DISCORD_CHOICE_API_LIMIT,
					choices.length - DISCORD_CHOICE_API_LIMIT
				);
			}
			await interaction.respond(
				choices.map((choice) => ({ name: choice, value: choice }))
			);
		}
	},

	async initialize(client: FreddieBotClient): Promise<void> {
		const instancer =
			createChannelInstancer<DiscordChannelScopedTimerAggregator>();
		(client as HasTimerAggregators)[timerSymbol] = instancer;
		const existingTimers = await client.bosses.getExistingTimers();
		for (const { name, channelId, channel, expiration } of existingTimers) {
			const timerAggregator = getTimerAggregatorForChannel(
				client,
				channelId
			);
			timerAggregator.addBossTimer(name, expiration, [channel]);
		}
	},
};

function getTimerAggregatorForChannel(
	client: FreddieBotClient,
	channelId: string
): DiscordChannelScopedTimerAggregator {
	const clientReadyP = client.isReady()
		? Promise.resolve()
		: new Promise((resolve) =>
				(client as FreddieBotClient).once('ready', resolve)
		  );
	const instancer = (client as HasTimerAggregators)[timerSymbol];
	const timerAggregator = instancer.getOrCreate(channelId, () =>
		createTimerAggregator(async (name, channels, expiration) => {
			if (!client.isReady()) {
				await clientReadyP;
			}
			const sendTimerReminder = async () => {
				const clearTimersP = client.bosses.clearBossTimer(
					name,
					channelId,
					channels
				);
				const discordChannel = await client.channels.fetch(channelId);
				if (timerAggregator.isEmpty) {
					instancer.delete(channelId);
				}
				assert(
					discordChannel.isTextBased(),
					'Attempted to send bosstimer reminder to non-text-based channel.'
				);
				const respawnTimeMs = bosses.get(name);
				assert(respawnTimeMs !== undefined, `Unexpected boss: ${name}`);
				await Promise.all([
					clearTimersP,
					discordChannel?.send(
						`**${name}** is spawning between now and ${shortTime(
							expiration + 2 * respawnTimeMs * RESPAWN_VARIANCE
						)} on the following channels: ${channels.join(', ')}.`
					),
				]);
			};

			// This ensures errors get propagated to the client.
			client.pushAsyncWork('boss-timer', sendTimerReminder());
		})
	);
	return timerAggregator;
}

type HasTimerAggregators = FreddieBotClient & {
	[timerSymbol]: ChannelInstancer<DiscordChannelScopedTimerAggregator>;
};

const timerSymbol = Symbol('bosstimer');
function getTimerAggregatorInstancer(
	interaction: ChatInputCommandInteraction
): ChannelInstancer<DiscordChannelScopedTimerAggregator> {
	const instancer = (interaction.client as HasTimerAggregators)[timerSymbol];
	assert(instancer !== undefined);
	return instancer;
}

async function parseAndValidateChannel(
	interaction: ChatInputCommandInteraction
): Promise<number[] | undefined> {
	const arg = interaction.options.getString(CHANNEL_ARG);
	if (arg.toLowerCase() === 'all') {
		return Array.from(allChannels);
	}

	let channels: number[];
	try {
		channels = arg.split(' ').map((c) => parseInt(c, 10));
	} catch (error) {
		await interaction.reply({
			ephemeral: true,
			content:
				'Invalid channel argument. Please specify a space-separate list of numbers, or "all".',
		});
		return undefined;
	}

	if (channels.some((channel) => channel < 1 || channel > ML_CHANNELS)) {
		await interaction.reply({
			ephemeral: true,
			content: `Invalid channel argument. Channels must be between 1 and ${ML_CHANNELS}.`,
		});
		return undefined;
	}

	return channels;
}

async function parseAndValidateName(
	interaction: ChatInputCommandInteraction
): Promise<{ respawnCooldownMs: number; name: Boss } | undefined> {
	const name = interaction.options.getString(NAME_ARG);
	const respawnCooldownMs = bosses.get(name);
	if (respawnCooldownMs === undefined) {
		await interaction.reply({
			ephemeral: true,
			content: `This boss is not supported. Select one of: ${bossNames.join(
				', '
			)}.`,
		});
		return;
	}
	return { respawnCooldownMs, name };
}

async function addBossTimer(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const [channels, nameInfo] = await Promise.all([
		parseAndValidateChannel(interaction),
		parseAndValidateName(interaction),
	]);
	if (channels === undefined || nameInfo === undefined) {
		return;
	}

	const { name, respawnCooldownMs } = nameInfo;

	const client = interaction.client as FreddieBotClient;

	const respawnTimeMs =
		Date.now() + respawnCooldownMs * (1 - RESPAWN_VARIANCE);
	await Promise.all([
		interaction.deferReply(),
		client.bosses.addBossTimers(
			channels.map((channel) => ({
				name,
				channel,
				expiration: respawnTimeMs,
				channelId: interaction.channelId,
			}))
		),
	]);

	const { channelId } = interaction;
	const timerAggregator = getTimerAggregatorForChannel(client, channelId);

	timerAggregator.addBossTimer(name, respawnTimeMs, channels);

	if (channels.length > 1) {
		await interaction.editReply(
			`${name} timer added on channels: ${channels.join(', ')}.`
		);
	} else {
		await interaction.editReply(
			`${name} timer added on channel ${channels[0]}.`
		);
	}
}

async function showBossTimers(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const { name, respawnCooldownMs } =
		(await parseAndValidateName(interaction)) ?? {};
	if (name === undefined || respawnCooldownMs === undefined) {
		return;
	}

	const instancer = getTimerAggregatorInstancer(interaction);
	const timerAggregator = instancer.get(interaction.channelId);
	const noTimersMsg = 'No timers are pending for this boss.';
	if (timerAggregator === undefined) {
		await interaction.reply(noTimersMsg);
		return;
	}

	const timers = timerAggregator.getExistingTimers(name);
	if (timers.length === 0) {
		await interaction.reply(noTimersMsg);
		return;
	}

	timers.sort((a, b) => a.channel - b.channel);
	await interaction.reply(
		`**${name}** will spawn on:\n\n${timers
			.map(
				(t) =>
					`Channel ${t.channel}: between ${shortTime(
						t.expiration
					)} and ${shortTime(
						t.expiration + respawnCooldownMs * RESPAWN_VARIANCE
					)}`
			)
			.join('\n')}`
	);
}

function shortTime(ms: number): string {
	return `<t:${Math.floor(ms / 1000)}:t>`;
}

async function deleteBossTimer(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const [channels, nameInfo] = await Promise.all([
		parseAndValidateChannel(interaction),
		parseAndValidateName(interaction),
	]);
	if (channels === undefined || nameInfo === undefined) {
		return;
	}

	const { name } = nameInfo;

	const instancer = getTimerAggregatorInstancer(interaction);
	const timerAggregator = instancer.get(interaction.channelId);
	if (timerAggregator === undefined) {
		await interaction.reply('No timers were pending for this boss.');
		return;
	}

	const previousTimers = timerAggregator.getExistingTimers(name);
	const removedTimers = previousTimers
		.filter((timer) => channels.includes(timer.channel))
		.map((t) => t.channel);

	if (removedTimers.length === 0) {
		await interaction.reply('No timers were pending for this boss.');
		return;
	}
	timerAggregator.clearBossTimer(name, channels);

	if (timerAggregator.isEmpty) {
		instancer.delete(interaction.channelId);
	}

	const client = interaction.client as FreddieBotClient;
	await Promise.all([
		interaction.deferReply(),
		client.bosses.clearBossTimer(
			name,
			interaction.channelId,
			removedTimers
		),
	]);

	let msg = `${name} timer removed on ${
		removedTimers.length === 1
			? `channel ${removedTimers[0]}`
			: `channels: ${removedTimers.join(', ')}`
	}.`;

	if (removedTimers.length !== channels.length) {
		msg += ' No timer was set on remaining channels.';
	}
	await interaction.editReply(msg);
}

interface ChannelInstancer<T> {
	get(channelId: string): T | undefined;
	getOrCreate(channelId: string, lazyCreate: () => T): T;
	delete(channelId: string): boolean;
}

function createChannelInstancer<T>(): ChannelInstancer<T> {
	const instances = new Map<string, T>();
	return {
		get(channelId: string): T | undefined {
			return instances.get(channelId);
		},
		getOrCreate(channelId: string, lazyCreate: () => T): T {
			let instance = instances.get(channelId);
			if (instance === undefined) {
				instance = lazyCreate();
				instances.set(channelId, instance);
			}
			return instance;
		},
		delete(channelId: string): boolean {
			return instances.delete(channelId);
		},
	};
}

interface DiscordChannelScopedTimerAggregator {
	addBossTimer(name: Boss, expiration: number, channels: number[]): void;
	getExistingTimers(name: Boss): { channel: number; expiration: number }[];
	clearBossTimer(name: Boss, channels: number[]): void;
	isEmpty: boolean;
}

const roundToNearestMinute = (ms: number) =>
	Math.floor(ms / msPer.minute) * msPer.minute;

const allChannels = Array.from({ length: ML_CHANNELS }, (_, i) => i + 1);

/**
 * beware: onTimerExpired does not propagate errors. Creator is expected to handle them appropriately.
 */
function createTimerAggregator(
	onTimerExpired: (
		name: Boss,
		channels: number[],
		expiration: number
	) => Promise<void>,
	round: (ms: number) => number = roundToNearestMinute
): DiscordChannelScopedTimerAggregator {
	// Active timers for all bosses scoped to a given discord channel.
	const timers = new Map<
		Boss,
		Map</* channel */ number, /* expiration */ number>
	>();
	const pendingTimeouts = new Map<Boss, NodeJS.Timeout>();

	function addTimer(name: Boss, expiration: number, channel: number) {
		assert(
			channel >= 1 && channel <= ML_CHANNELS,
			`Invalid channel: ${channel}`
		);
		const channelTimers = timers.get(name) ?? new Map<number, number>();
		channelTimers.set(channel, expiration);
		timers.set(name, channelTimers);
	}

	function removeTimer(name: Boss, channel: number) {
		const channelTimers = timers.get(name);
		if (channelTimers === undefined) {
			return;
		}
		channelTimers.delete(channel);
		if (channelTimers.size === 0) {
			timers.delete(name);
		}
	}

	function nextTimerFor(name: Boss): {
		expiration: number | undefined;
		channels: number[];
	} {
		const channelTimers = timers.get(name);
		if (channelTimers === undefined) {
			return { expiration: undefined, channels: [] };
		}

		const expiration = Math.min(...channelTimers.values());
		return {
			expiration,
			channels: allChannels.filter(
				(channel) =>
					channelTimers.get(channel) !== undefined &&
					round(channelTimers.get(channel)) === round(expiration)
			),
		};
	}

	function recomputeNextTimeout(name: Boss): void {
		const existingTimeout = pendingTimeouts.get(name);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		const nextNotification = nextTimerFor(name);
		if (nextNotification.expiration !== undefined) {
			const timeoutId = setTimeout(() => {
				clearBossTimer(name, nextNotification.channels);
				onTimerExpired(
					name,
					nextNotification.channels,
					nextNotification.expiration
				);
			}, nextNotification.expiration - Date.now());
			pendingTimeouts.set(name, timeoutId);
		}
	}

	function addBossTimer(name: Boss, expiration: number, channels: number[]) {
		for (const channel of channels) {
			addTimer(name, expiration, channel);
		}

		recomputeNextTimeout(name);
	}

	function getExistingTimers(
		name: Boss
	): { channel: number; expiration: number }[] {
		return Array.from(timers.get(name)?.entries() ?? []).map(
			([channel, expiration]) => ({ channel, expiration })
		);
	}

	function clearBossTimer(name: Boss, channels: number[]): void {
		for (const channel of channels) {
			removeTimer(name, channel);
		}

		recomputeNextTimeout(name);
	}
	return {
		addBossTimer,
		getExistingTimers,
		clearBossTimer,
		get isEmpty() {
			return timers.size === 0;
		},
	};
}
