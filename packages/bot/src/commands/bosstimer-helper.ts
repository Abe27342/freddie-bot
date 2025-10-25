import { FreddieBotClient } from '../types';
import { assert, isNotPartialChannel } from '../utils/index.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const RESPAWN_VARIANCE = 0.1;
export const ML_CHANNELS = 6;

export const msPer = {
	second: 1000,
	minute: 60 * 1000,
	hour: 60 * 60 * 1000,
};

export const bosses = new Map<string, number>([
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
export const bossNames = Array.from(bosses.keys());

export type Boss = string;

export interface DiscordChannelScopedTimerAggregator {
	addBossTimer(name: Boss, expiration: number, channels: number[]): void;
	getExistingTimers(name: Boss): { channel: number; expiration: number }[];
	clearBossTimer(name: Boss, channels: number[]): void;
	isEmpty: boolean;
}

export interface ChannelInstancer<T> {
	get(channelId: string): T | undefined;
	getOrCreate(channelId: string, lazyCreate: () => T): T;
	delete(channelId: string): boolean;
}

export type HasTimerAggregators = FreddieBotClient & {
	[timerSymbol]: ChannelInstancer<DiscordChannelScopedTimerAggregator>;
};

export const timerSymbol = Symbol.for('bosstimer');
export const roundToNearestMinute = (ms: number) =>
	Math.floor(ms / msPer.minute) * msPer.minute;
export const allChannels = Array.from({ length: ML_CHANNELS }, (_, i) => i + 1);

export function shortTime(ms: number): string {
	return `<t:${Math.floor(ms / 1000)}:t>`;
}

export function longTime(ms: number): string {
	return `<t:${Math.floor(ms / 1000)}:f>`;
}

export function isTimerExpired(expiration: number): boolean {
	return expiration < Date.now();
}

export function createTimerAggregator(
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
					round(channelTimers.get(channel)!) === round(expiration)
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
					nextNotification.expiration!
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

export function createChannelInstancer<T>(): ChannelInstancer<T> {
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

// Access the timer aggregator using getOrCreate semantics like in bosstimer.ts
export function getTimerAggregatorForChannel(
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
				// Mark the timer as having its reminder sent in the database
				const markReminderSentP = client.bosses.markTimerReminderSent(
					name,
					channelId,
					channels
				);
				const discordChannel = await client.channels.fetch(channelId);
				if (timerAggregator.isEmpty) {
					instancer.delete(channelId);
				}
				assert(
					discordChannel?.isTextBased() &&
						isNotPartialChannel(discordChannel),
					'Attempted to send bosstimer reminder to non-text-based channel.'
				);
				const respawnTimeMs = bosses.get(name);
				assert(respawnTimeMs !== undefined, `Unexpected boss: ${name}`);
				await Promise.all([
					markReminderSentP,
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

export async function addBossTimerForChannel(
	client: FreddieBotClient,
	channelId: string,
	bossName: string,
	channel: number
): Promise<void> {
	const respawnCooldownMs = bosses.get(bossName);
	if (respawnCooldownMs === undefined) {
		throw new Error(`Invalid boss name: ${bossName}`);
	}

	if (channel < 1 || channel > ML_CHANNELS) {
		throw new Error(`Invalid channel: ${channel}`);
	}

	// Check if timer already exists
	const timerAggregator = getTimerAggregatorForChannel(client, channelId);
	const existingTimers = timerAggregator.getExistingTimers(bossName);
	const existingTimer = existingTimers.find(
		(t: { channel: number; expiration: number }) => t.channel === channel
	);
	if (existingTimer) {
		throw new Error(
			`Timer already exists for ${bossName} on channel ${channel}`
		);
	}

	const respawnTimeMs =
		Date.now() + respawnCooldownMs * (1 - RESPAWN_VARIANCE);

	await client.bosses.addBossTimers([
		{
			name: bossName,
			channel,
			expiration: respawnTimeMs,
			channelId,
		},
	]);

	timerAggregator.addBossTimer(bossName, respawnTimeMs, [channel]);
}

// Helper function to build the message content and buttons for the quick command
export function buildBossTimerMessage(
	bossName: string,
	timers: { channel: number; expiration: number; reminderSent?: boolean }[],
	respawnCooldownMs: number
): { content: string; components: ActionRowBuilder<ButtonBuilder>[] } {
	// Create message content
	let content = `**${bossName}** timers:\n\n`;

	// Keep only the most recent timer per channel
	const timersByChannel = new Map<number, (typeof timers)[0]>();
	for (const timer of timers) {
		const existing = timersByChannel.get(timer.channel);
		if (!existing || timer.expiration > existing.expiration) {
			timersByChannel.set(timer.channel, timer);
		}
	}

	// Display all channels (1 through ML_CHANNELS)
	const channelLines: string[] = [];
	for (const channel of allChannels) {
		const timer = timersByChannel.get(channel);

		if (!timer) {
			channelLines.push(`Channel ${channel}: no spawn time found`);
		} else {
			// Timer is only considered expired for display purposes 1 minute after the possible end spawn time
			const endSpawnTime =
				timer.expiration + 2 * respawnCooldownMs * RESPAWN_VARIANCE;
			const isExpired = Date.now() > endSpawnTime + msPer.minute;
			const timeFormat = isExpired ? longTime : shortTime;

			let statusNote = '';
			if (isExpired) {
				statusNote = ' *(timer expired)*';
			}

			const earlyTime = timeFormat(timer.expiration);
			const lateTime = timeFormat(endSpawnTime);

			if (isExpired) {
				channelLines.push(
					`Channel ${channel}: last known spawn between ${earlyTime} and ${lateTime}${statusNote}`
				);
			} else {
				channelLines.push(
					`Channel ${channel}: will spawn between ${earlyTime} and ${lateTime}${statusNote}`
				);
			}
		}
	}

	content += channelLines.join('\n');
	content += '\n\n';

	content += 'Click a button below to add a timer for that channel:';

	// Create buttons for each channel
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];

	// Create buttons in rows of 5 (Discord's limit)
	for (let i = 0; i < ML_CHANNELS; i += 5) {
		const row = new ActionRowBuilder<ButtonBuilder>();

		for (
			let channel = i + 1;
			channel <= Math.min(i + 5, ML_CHANNELS);
			channel++
		) {
			const button = new ButtonBuilder()
				.setCustomId(`bosstimer_add|${bossName}_${channel}`)
				.setLabel(`Ch ${channel}`)
				.setStyle(ButtonStyle.Primary);

			row.addComponents(button);
		}

		rows.push(row);
	}

	return { content, components: rows };
}
