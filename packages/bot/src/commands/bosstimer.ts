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
	['anego', 1 * msPer.minute],
	['samurai', 0.5 * msPer.minute],
	['mano', 1 * msPer.hour],
	['faust', 1],
	['clang', 1],
	['timer', 1],
	['mushmom', 1],
	['dyle', 1],
	['zmushmom', 1],
	['fox', 1],
	['taeroon', 1],
	['sagecat', 1],
	['eliza', 1],
	['snowman', 1],
	['manon', 1],
	['griffey', 1],
	['pianusl', 1],
	['pianusr', 1],
	['stumpy', 1],
	['balrog', 1],
	['deo', 1],
	['seruf', 1],
	['zeno', 1],
	['kimera', 1],
	['levi', 1],
	['dodo', 1],
	['lilynouch', 1],
	['lyka', 1],
	['bigfoot', 1],
	['crow', 1],
	['spirit', 1],
	['shade', 1],
	['dummy', 1],
	['riche', 1],
	['witch', 1],
	['camera', 1],
	['scholar', 1],
	['rurumo', 1],
	['deetnroi', 1],
]);
const bossNames = Array.from(bosses.keys());

const bossNameUsageHelpMessage = `This boss is not supported. Select one of: ${bossNames.join(
	', '
)}.`;

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
		(client as HasTimerAggregators)[timerSymbol] = createChannelInstancer();
		// TODO: Populate from db here.
		// Should be a query -> bunch of createTimerAggregator calls with non-empty lists.
	},
};

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

function parseChannelArg(arg: string): number[] | undefined {
	if (arg === 'all') {
		return Array.from({ length: ML_CHANNELS }, (_, i) => i + 1);
	}
	try {
		return arg.split(' ').map((c) => parseInt(c, 10));
	} catch (error) {
		return undefined;
	}
}

async function addBossTimer(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const name = interaction.options.getString(NAME_ARG);
	const channels = parseChannelArg(
		interaction.options.getString(CHANNEL_ARG)
	);
	if (channels === undefined) {
		await interaction.reply(
			'Invalid channel argument. Please specify a space-separate list of numbers, or "all".'
		);
		return;
	}
	const respawnTimeMs = bosses.get(name);
	if (respawnTimeMs === undefined) {
		await interaction.reply(bossNameUsageHelpMessage);
		return;
	}

	const instancer = getTimerAggregatorInstancer(interaction);
	const timerAggregator = instancer.getOrCreate(interaction.channelId, () =>
		createTimerAggregator([], async (name, channels, expiration) => {
			// clearing boss timer is already good... need to clear from db here.
			// TODO: try-catch this, error handling is on u
			await interaction.channel?.send(
				`**${name}** is spawning between now and <t:${Math.floor(
					(expiration + 2 * respawnTimeMs * RESPAWN_VARIANCE) / 1000
				)}:t> on the following channels: ${channels.join(', ')}.`
			);
			if (timerAggregator.isEmpty) {
				instancer.delete(interaction.channelId);
			}
		})
	);
	timerAggregator.addBossTimer(
		name,
		Date.now() + respawnTimeMs * (1 - RESPAWN_VARIANCE),
		channels
	);

	if (channels.length > 1) {
		await interaction.reply(
			`${name} timer added on channels: ${channels.join(', ')}.`
		);
	} else {
		await interaction.reply(
			`${name} timer added on channel ${channels[0]}.`
		);
	}
}

async function showBossTimers(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const name = interaction.options.getString(NAME_ARG);
	const respawnTimeMs = bosses.get(name);
	if (respawnTimeMs === undefined) {
		await interaction.reply(bossNameUsageHelpMessage);
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
						t.expiration + respawnTimeMs * RESPAWN_VARIANCE
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
	const name = interaction.options.getString(NAME_ARG);
	const channels = parseChannelArg(
		interaction.options.getString(CHANNEL_ARG)
	);
	if (channels === undefined) {
		await interaction.reply(
			'Invalid channel argument. Please specify a space-separate list of numbers, or "all".'
		);
		return;
	}
	const respawnTimeMs = bosses.get(name);
	if (respawnTimeMs === undefined) {
		await interaction.reply(bossNameUsageHelpMessage);
		return;
	}

	const instancer = getTimerAggregatorInstancer(interaction);
	const timerAggregator = instancer.get(interaction.channelId);
	if (timerAggregator === undefined) {
		await interaction.reply('No timers were pending for this boss.');
		return;
	}

	const previousTimers = timerAggregator.getExistingTimers(name);
	timerAggregator.clearBossTimer(name, channels);
	const removedTimers = previousTimers.filter((timer) =>
		channels.includes(timer.channel)
	);
	// TODO: Remove database entries for removedTimers.
	// TODO: generally audit this file for reply deferral.

	if (timerAggregator.isEmpty) {
		instancer.delete(interaction.channelId);
	}

	let msg = `${name} timer removed on channels: ${channels.join(', ')}.`;

	if (removedTimers.length !== channels.length) {
		msg += ' No timer was set on remaining channels.';
	}
	await interaction.reply(msg);
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
	initialTimers: { name: Boss; expiration: number; channel: number }[],
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

	for (const { name, expiration, channel } of initialTimers) {
		addTimer(name, expiration, channel);
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
