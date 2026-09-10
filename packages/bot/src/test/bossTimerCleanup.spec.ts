import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BOSS_TIMER_CLEANUP_INTERVAL_MS,
	BOSS_TIMER_CLEANUP_BATCH_DELAY_MS,
	BOSS_TIMER_CLEANUP_RETRY_DELAY_MS,
	BOSS_TIMER_CLEANUP_MAX_RETRY_DELAY_MS,
	startBossTimerCleanup,
} from '../bossTimerCleanup';
import {
	BOSS_TIMER_CLEANUP_BATCH_SIZE,
	BOSS_TIMER_RETENTION_MS,
} from '../db/bossTimers';
import type { FreddieBotClient } from '../types';
import { makeMockDb } from './mockDb';

describe('recurring boss timer cleanup', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	function createCleanupClient() {
		const errors: unknown[] = [];
		const client: Pick<FreddieBotClient, 'bosses' | 'pushAsyncWork'> = {
			bosses: makeMockDb(),
			pushAsyncWork: vi.fn((_name, work) => {
				void work.catch((error) => errors.push(error));
			}),
		};
		return { client, errors };
	}

	it('drains July timers across multiple passes while retaining recent history', async () => {
		const { client } = createCleanupClient();
		const timer = {
			name: 'manon',
			channelId: 'discord-channel',
			channel: 1,
			expiration: new Date('2026-07-01T12:00:00Z').getTime(),
		};
		const retained = [
			{ ...timer, expiration: Date.now() - BOSS_TIMER_RETENTION_MS },
			{ ...timer, expiration: Date.now() - 1000, reminderSent: true },
			{ ...timer, expiration: Date.now() + 1000 },
		];
		const timers = [
			...Array.from(
				{ length: BOSS_TIMER_CLEANUP_BATCH_SIZE + 1 },
				() => ({ ...timer })
			),
			...retained,
		];
		client.bosses = makeMockDb({ timers, reminders: [] });
		expect(await client.bosses.getExistingTimers()).toEqual(retained);
		startBossTimerCleanup(client);
		expect(timers).toHaveLength(BOSS_TIMER_CLEANUP_BATCH_SIZE + 4);

		await vi.advanceTimersByTimeAsync(0);
		expect(timers).toEqual([timer, ...retained]);
		await vi.advanceTimersByTimeAsync(BOSS_TIMER_CLEANUP_BATCH_DELAY_MS);
		// The exact retention-boundary timer becomes stale between passes.
		expect(timers).toEqual(retained.slice(1));
	});

	it('waits for a slow cleanup to finish before scheduling the next pass', async () => {
		const { client } = createCleanupClient();
		let finishCleanup: () => void = () => {
			throw new Error('Cleanup has not started');
		};
		const cleanup = vi
			.spyOn(client.bosses, 'clearStaleBossTimers')
			.mockImplementationOnce(
				() =>
					new Promise<{ hasMore: boolean }>((resolve) => {
						finishCleanup = () => resolve({ hasMore: true });
					})
			);
		startBossTimerCleanup(client);
		await vi.advanceTimersByTimeAsync(3 * BOSS_TIMER_CLEANUP_INTERVAL_MS);
		expect(cleanup).toHaveBeenCalledTimes(1);

		finishCleanup();
		await vi.advanceTimersByTimeAsync(BOSS_TIMER_CLEANUP_BATCH_DELAY_MS);
		expect(cleanup).toHaveBeenCalledTimes(2);
	});

	it('polls less frequently after the backlog is drained', async () => {
		const { client } = createCleanupClient();
		const cleanup = vi.spyOn(client.bosses, 'clearStaleBossTimers');
		startBossTimerCleanup(client);
		await vi.advanceTimersByTimeAsync(0);
		expect(cleanup).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(BOSS_TIMER_CLEANUP_INTERVAL_MS - 1);
		expect(cleanup).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(cleanup).toHaveBeenCalledTimes(2);
	});

	it('surfaces failures through the client and retries on the next pass', async () => {
		const { client, errors } = createCleanupClient();
		const error = new Error('Database unavailable');
		const cleanup = vi
			.spyOn(client.bosses, 'clearStaleBossTimers')
			.mockRejectedValueOnce(error);
		startBossTimerCleanup(client);

		await vi.advanceTimersByTimeAsync(0);
		expect(errors).toEqual([error]);
		expect(client.pushAsyncWork).toHaveBeenCalledWith(
			'boss-timer',
			expect.any(Promise)
		);
		await vi.advanceTimersByTimeAsync(BOSS_TIMER_CLEANUP_RETRY_DELAY_MS);
		expect(cleanup).toHaveBeenCalledTimes(2);
		expect(errors).toEqual([error]);
	});

	it('caps exponential backoff and resets it after a successful batch', async () => {
		const { client, errors } = createCleanupClient();
		const error = new Error('Cosmos DB rate limit exceeded');
		const cleanup = vi
			.spyOn(client.bosses, 'clearStaleBossTimers')
			.mockRejectedValue(error);
		startBossTimerCleanup(client);
		await vi.advanceTimersByTimeAsync(0);

		const delays = [5000, 10000, 20000, 40000, 60000, 60000];
		for (const [index, delay] of delays.entries()) {
			expect(delay).toBeLessThanOrEqual(
				BOSS_TIMER_CLEANUP_MAX_RETRY_DELAY_MS
			);
			await vi.advanceTimersByTimeAsync(delay - 1);
			expect(cleanup).toHaveBeenCalledTimes(index + 1);
			await vi.advanceTimersByTimeAsync(1);
			expect(cleanup).toHaveBeenCalledTimes(index + 2);
		}
		expect(errors).toHaveLength(7);

		cleanup.mockResolvedValueOnce({ hasMore: true });
		await vi.advanceTimersByTimeAsync(
			BOSS_TIMER_CLEANUP_MAX_RETRY_DELAY_MS
		);
		expect(cleanup).toHaveBeenCalledTimes(8);
		await vi.advanceTimersByTimeAsync(BOSS_TIMER_CLEANUP_BATCH_DELAY_MS);
		expect(cleanup).toHaveBeenCalledTimes(9);
		await vi.advanceTimersByTimeAsync(
			BOSS_TIMER_CLEANUP_RETRY_DELAY_MS - 1
		);
		expect(cleanup).toHaveBeenCalledTimes(9);
		await vi.advanceTimersByTimeAsync(1);
		expect(cleanup).toHaveBeenCalledTimes(10);
	});
});
