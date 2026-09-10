import type { Collection, Filter } from 'mongodb';
import type { BossTimer } from '../types';
import type { BossTimerQuery, BossTimerStorage } from './index';

export const BOSS_TIMER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const BOSS_TIMER_CLEANUP_BATCH_SIZE = 20;

type TimerCollection = Pick<
	Collection<BossTimer>,
	'createIndexes' | 'find' | 'deleteMany' | 'insertMany' | 'updateMany'
>;

export async function createBossTimerStorage(
	timers: TimerCollection
): Promise<BossTimerStorage> {
	await timers.createIndexes([
		{ key: { expiration: 1 } },
		{ key: { name: 1 } },
		{ key: { channelId: 1, name: 1, expiration: 1 } },
	]);

	async function getExistingTimers(
		query: BossTimerQuery = {}
	): Promise<BossTimer[]> {
		const filter: Filter<BossTimer> = {
			expiration: { $gte: Date.now() - BOSS_TIMER_RETENTION_MS },
			name: { $exists: true },
		};
		if (query.name !== undefined) {
			filter.name = query.name;
		}
		if (query.channelId !== undefined) {
			filter.channelId = query.channelId;
		}
		if (query.pendingOnly) {
			filter.reminderSent = { $ne: true };
		}
		return timers.find(filter).toArray();
	}

	async function clearStaleBossTimers(): Promise<{ hasMore: boolean }> {
		// Bound each pass so a large backlog cannot monopolize database capacity.
		const staleTimers = await timers
			.find(
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
			)
			.limit(BOSS_TIMER_CLEANUP_BATCH_SIZE)
			.toArray();
		if (staleTimers.length > 0) {
			await timers.deleteMany({
				_id: { $in: staleTimers.map((timer) => timer._id) },
			});
		}
		return {
			hasMore: staleTimers.length === BOSS_TIMER_CLEANUP_BATCH_SIZE,
		};
	}

	async function clearBossTimer(
		name: string,
		channelId: string,
		channels: number[]
	): Promise<void> {
		await timers.deleteMany({
			name,
			channelId,
			channel: { $in: channels },
		});
	}

	async function addBossTimers(timersToInsert: BossTimer[]): Promise<void> {
		const validTimers = timersToInsert.filter(
			(t) => t && t.name && t.expiration && t.channel && t.channelId
		);
		if (validTimers.length !== timersToInsert.length) {
			console.warn(
				`Some timers were invalid and will not be inserted. Valid timers: ${JSON.stringify(
					validTimers
				)}. All timers: ${JSON.stringify(timersToInsert)}`
			);
		}
		if (validTimers.length > 0) {
			await timers.insertMany(validTimers);
		}
	}

	async function markTimerReminderSent(
		name: string,
		channelId: string,
		channels: number[]
	): Promise<void> {
		await timers.updateMany(
			{ name, channelId, channel: { $in: channels } },
			{ $set: { reminderSent: true } }
		);
	}

	return {
		getExistingTimers,
		clearStaleBossTimers,
		clearBossTimer,
		addBossTimers,
		markTimerReminderSent,
	};
}
