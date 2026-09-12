import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBossTimerStorage } from '../../db/bossTimers';
import type { BossTimerStorage } from '../../db';

describe('boss timer storage', () => {
	const cursor = {
		toArray: vi.fn(),
	};
	const collection = {
		createIndexes: vi.fn(),
		find: vi.fn(),
		deleteMany: vi.fn(),
		insertMany: vi.fn(),
		updateMany: vi.fn(),
	};
	let storage: BossTimerStorage;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
		vi.resetAllMocks();
		cursor.toArray.mockResolvedValue([]);
		collection.find.mockReturnValue(cursor);
		storage = await createBossTimerStorage(collection);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('enables seven-day Cosmos TTL and single-field query indexes without deleting on startup', () => {
		expect(collection.createIndexes).toHaveBeenCalledWith([
			{ key: { _ts: 1 }, expireAfterSeconds: 604800 },
			{ key: { name: 1 } },
			{ key: { channelId: 1 } },
		]);
		expect(collection.find).not.toHaveBeenCalled();
		expect(collection.deleteMany).not.toHaveBeenCalled();
	});

	it('excludes incomplete timers without imposing a spawn-time retention cutoff', async () => {
		await storage.getExistingTimers();
		expect(collection.find).toHaveBeenCalledWith({
			expiration: { $exists: true },
			name: { $exists: true },
		});
	});

	it('only requests unsent reminders for startup', async () => {
		await storage.getExistingTimers({ pendingOnly: true });
		expect(collection.find).toHaveBeenCalledWith({
			expiration: { $exists: true },
			name: { $exists: true },
			reminderSent: { $ne: true },
		});
	});

	it('scopes display queries and leaves retention to Cosmos last-modified TTL', async () => {
		const timers = [
			{
				name: 'manon',
				channelId: 'discord-channel',
				channel: 1,
				expiration: new Date('2026-07-01T12:00:00Z').getTime(),
				reminderSent: true,
			},
		];
		cursor.toArray.mockResolvedValue(timers);
		await expect(
			storage.getExistingTimers({
				name: 'manon',
				channelId: 'discord-channel',
			})
		).resolves.toEqual(timers);
		expect(collection.find).toHaveBeenCalledWith({
			expiration: { $exists: true },
			name: 'manon',
			channelId: 'discord-channel',
		});
	});

	it('propagates TTL index setup failures instead of running without expiration', async () => {
		const error = new Error('Index creation failed');
		collection.createIndexes.mockRejectedValueOnce(error);
		await expect(createBossTimerStorage(collection)).rejects.toThrow(error);
		expect(collection.deleteMany).not.toHaveBeenCalled();
	});

	it('preserves timer insertion, reminder marking, and explicit deletion', async () => {
		const timer = {
			name: 'manon',
			channelId: 'discord-channel',
			channel: 1,
			expiration: Date.now() + 1000,
		};
		await storage.addBossTimers([timer]);
		expect(collection.insertMany).toHaveBeenCalledWith([timer]);

		await storage.markTimerReminderSent('manon', 'discord-channel', [1]);
		const filter = {
			name: 'manon',
			channelId: 'discord-channel',
			channel: { $in: [1] },
		};
		expect(collection.updateMany).toHaveBeenCalledWith(filter, {
			$set: { reminderSent: true },
		});

		await storage.clearBossTimer('manon', 'discord-channel', [1]);
		expect(collection.deleteMany).toHaveBeenCalledWith(filter);
	});
});
