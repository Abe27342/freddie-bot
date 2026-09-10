import { Collection } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bosstimer } from '../../commands/bosstimer';
import {
	HasTimerAggregators,
	timerSymbol,
} from '../../commands/bosstimer-helper';
import type { Command } from '../../commands/types';
import type { InteractionHandler } from '../../interactions/types';
import type { BossTimer, FreddieBotClient } from '../../types';
import { makeMockDb } from '../mockDb';
import { MockDiscord } from '../mockDiscord';

describe('boss timer command storage', () => {
	let mockDiscord: MockDiscord;
	let client: FreddieBotClient;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
		mockDiscord = new MockDiscord();
		client = Object.assign(mockDiscord.getClient(), {
			bosses: makeMockDb(),
			commands: new Collection<string, Command>(),
			interactions: new Collection<string, InteractionHandler>(),
			pushAsyncWork: vi.fn(),
			ensurePendingWorkProcessed: vi.fn(),
			enqueueReminder: vi.fn(),
		});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('loads only retained, unsent timers and starts cleanup after ready', async () => {
		const timer = {
			name: 'manon',
			channelId: 'discord-channel',
			channel: 1,
			expiration: Date.now() + 60 * 1000,
		};
		client.bosses = makeMockDb({
			reminders: [],
			timers: [
				timer,
				{ ...timer, channelId: 'sent-channel', reminderSent: true },
				{
					...timer,
					channelId: 'stale-channel',
					expiration: new Date('2026-07-01T12:00:00Z').getTime(),
				},
			],
		});
		const getTimers = vi.spyOn(client.bosses, 'getExistingTimers');
		const cleanup = vi.spyOn(client.bosses, 'clearStaleBossTimers');

		await bosstimer.initialize!(client);
		expect(getTimers).toHaveBeenCalledWith({ pendingOnly: true });
		const instancer = (client as HasTimerAggregators)[timerSymbol];
		expect(
			instancer.get('discord-channel')?.getExistingTimers('manon')
		).toEqual([{ channel: 1, expiration: timer.expiration }]);
		expect(instancer.get('sent-channel')).toBeUndefined();
		expect(instancer.get('stale-channel')).toBeUndefined();
		await vi.advanceTimersByTimeAsync(0);
		expect(cleanup).not.toHaveBeenCalled();

		vi.spyOn(client, 'isReady').mockReturnValue(true);
		if (!client.isReady()) {
			throw new Error('Expected mock client to be ready');
		}
		client.emit('ready', client);
		await vi.advanceTimersByTimeAsync(0);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it('defers show replies and queries only the requested boss and Discord channel', async () => {
		const interaction = mockDiscord.createCommandInteraction({
			name: 'bosstimer',
			options: [
				{
					name: 'show',
					type: 1,
					options: [{ name: 'name', value: 'manon', type: 3 }],
				},
			],
		});
		Object.assign(interaction, { channelId: 'discord-channel' });
		const getTimers = vi
			.spyOn(client.bosses, 'getExistingTimers')
			.mockImplementation(async (): Promise<BossTimer[]> => {
				expect(interaction.deferReply).toHaveBeenCalled();
				return [];
			});

		await bosstimer.execute(interaction);

		expect(getTimers).toHaveBeenCalledWith({
			name: 'manon',
			channelId: 'discord-channel',
		});
		expect(interaction.editReply).toHaveBeenCalledWith({
			content: expect.stringContaining('**manon** timers:'),
			components: expect.any(Array),
		});
		expect(interaction.reply).not.toHaveBeenCalled();
	});
});
