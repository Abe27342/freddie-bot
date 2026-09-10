import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BOSS_TIMER_CLEANUP_BATCH_SIZE,
	BOSS_TIMER_RETENTION_MS,
	createBossTimerStorage,
} from '../../db/bossTimers';
import type { BossTimerStorage } from '../../db';

describe('boss timer storage', () => {
	const cursor = {
		limit: vi.fn(),
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
		cursor.limit.mockReturnValue(cursor);
		cursor.toArray.mockResolvedValue([]);
		collection.find.mockReturnValue(cursor);
		storage = await createBossTimerStorage(collection);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('indexes queries without deleting the backlog during startup', () => {
		expect(collection.createIndexes).toHaveBeenCalledWith([
			{ key: { expiration: 1 } },
			{ key: { name: 1 } },
			{ key: { channelId: 1, name: 1, expiration: 1 } },
		]);
		expect(collection.find).not.toHaveBeenCalled();
		expect(collection.deleteMany).not.toHaveBeenCalled();
	});

	it('excludes stale and nameless timers from every read', async () => {
		await storage.getExistingTimers();
		expect(collection.find).toHaveBeenCalledWith({
			expiration: { $gte: Date.now() - BOSS_TIMER_RETENTION_MS },
			name: { $exists: true },
		});

		vi.setSystemTime(Date.now() + BOSS_TIMER_RETENTION_MS);
		await storage.getExistingTimers();
		expect(collection.find).toHaveBeenLastCalledWith({
			expiration: { $gte: Date.now() - BOSS_TIMER_RETENTION_MS },
			name: { $exists: true },
		});
	});

	it('only requests unsent reminders for startup', async () => {
		await storage.getExistingTimers({ pendingOnly: true });
		expect(collection.find).toHaveBeenCalledWith({
			expiration: { $gte: Date.now() - BOSS_TIMER_RETENTION_MS },
			name: { $exists: true },
			reminderSent: { $ne: true },
		});
	});

	it('scopes display queries without excluding recently expired timers', async () => {
		const timers = [
			{
				name: 'manon',
				channelId: 'discord-channel',
				channel: 1,
				expiration: Date.now() - 1000,
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
			expiration: { $gte: Date.now() - BOSS_TIMER_RETENTION_MS },
			name: 'manon',
			channelId: 'discord-channel',
		});
	});

	it('deletes only one bounded batch of stale or incomplete documents', async () => {
		const staleTimers = Array.from(
			{ length: BOSS_TIMER_CLEANUP_BATCH_SIZE },
			(_, _id) => ({ _id })
		);
		cursor.toArray.mockResolvedValue(staleTimers);

		await expect(storage.clearStaleBossTimers()).resolves.toEqual({
			hasMore: true,
		});

		expect(collection.find).toHaveBeenCalledWith(
			{
				$or: [
					{
						expiration: {
							$lt: Date.now() - BOSS_TIMER_RETENTION_MS,
						},
					},
					{ name: { $exists: false } },
					{ expiration: { $exists: false } },
				],
			},
			{ projection: { _id: 1 } }
		);
		expect(cursor.limit).toHaveBeenCalledWith(20);
		expect(collection.deleteMany).toHaveBeenCalledTimes(1);
		expect(collection.deleteMany).toHaveBeenCalledWith({
			_id: { $in: staleTimers.map((timer) => timer._id) },
		});
	});

	it('does not issue a delete when there is nothing stale', async () => {
		await expect(storage.clearStaleBossTimers()).resolves.toEqual({
			hasMore: false,
		});
		expect(collection.deleteMany).not.toHaveBeenCalled();
	});

	it('finishes draining when fewer than a full batch remain', async () => {
		cursor.toArray.mockResolvedValueOnce([{ _id: 'stale' }]);
		await expect(storage.clearStaleBossTimers()).resolves.toEqual({
			hasMore: false,
		});
		expect(collection.deleteMany).toHaveBeenCalledWith({
			_id: { $in: ['stale'] },
		});
	});

	it('propagates cleanup query and delete failures', async () => {
		const error = new Error('Database request failed');
		cursor.toArray.mockRejectedValueOnce(error);
		await expect(storage.clearStaleBossTimers()).rejects.toThrow(error);
		expect(collection.deleteMany).not.toHaveBeenCalled();

		cursor.toArray.mockResolvedValueOnce([{ _id: 'stale' }]);
		collection.deleteMany.mockRejectedValueOnce(error);
		await expect(storage.clearStaleBossTimers()).rejects.toThrow(error);
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
