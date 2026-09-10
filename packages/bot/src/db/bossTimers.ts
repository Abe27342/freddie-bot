import type { Collection, Filter } from 'mongodb';
import type { BossTimer } from '../types';
import type { BossTimerQuery, BossTimerStorage } from './index';

export const BOSS_TIMER_TTL_SECONDS = 7 * 24 * 60 * 60;

type TimerCollection = Pick<
	Collection<BossTimer>,
	'createIndexes' | 'find' | 'deleteMany' | 'insertMany' | 'updateMany'
>;

export async function createBossTimerStorage(
	timers: TimerCollection
): Promise<BossTimerStorage> {
	// This only ensures indexes exist; removing a definition here does not drop
	// its database index. Manage index changes/removals manually for now, and
	// revisit this strategy if index requirements start changing frequently.
	await timers.createIndexes([
		// Cosmos DB expires documents relative to its internal last-modified time.
		{ key: { _ts: 1 }, expireAfterSeconds: BOSS_TIMER_TTL_SECONDS },
		{ key: { name: 1 } },
		{ key: { channelId: 1 } },
	]);

	async function getExistingTimers(
		query: BossTimerQuery = {}
	): Promise<BossTimer[]> {
		const filter: Filter<BossTimer> = {
			expiration: { $exists: true },
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
		clearBossTimer,
		addBossTimers,
		markTimerReminderSent,
	};
}
