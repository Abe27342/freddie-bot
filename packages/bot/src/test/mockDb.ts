import { BossTimerQuery, FreddieBotDb } from '../db';
import { Reminder, DbId, BossTimer } from '../types';
import {
	BOSS_TIMER_CLEANUP_BATCH_SIZE,
	BOSS_TIMER_RETENTION_MS,
} from '../db/bossTimers';

export function makeMockDb(
	{ reminders, timers }: { reminders: Reminder[]; timers: BossTimer[] } = {
		reminders: [],
		timers: [],
	}
): FreddieBotDb {
	async function getRemindersBefore(time: number): Promise<Reminder[]> {
		return reminders.filter((reminder) => reminder.expiration < time);
	}

	async function clearReminder(id: DbId): Promise<void> {
		for (let i = reminders.length; i--; i >= 0) {
			if (reminders[i].id === id) {
				reminders.splice(i, 1);
			}
		}
	}

	async function addReminder(reminder: Reminder): Promise<void> {
		reminders.push(reminder);
	}

	async function getExistingTimers(
		query: BossTimerQuery = {}
	): Promise<BossTimer[]> {
		return timers.filter(
			(timer) =>
				timer.expiration >= Date.now() - BOSS_TIMER_RETENTION_MS &&
				timer.name !== undefined &&
				(query.name === undefined || timer.name === query.name) &&
				(query.channelId === undefined ||
					timer.channelId === query.channelId) &&
				(!query.pendingOnly || !timer.reminderSent)
		);
	}

	async function clearStaleBossTimers(): Promise<{ hasMore: boolean }> {
		let deleted = 0;
		for (let i = timers.length - 1; i >= 0; i--) {
			if (
				timers[i].expiration < Date.now() - BOSS_TIMER_RETENTION_MS ||
				timers[i].name === undefined ||
				timers[i].expiration === undefined
			) {
				timers.splice(i, 1);
				if (++deleted === BOSS_TIMER_CLEANUP_BATCH_SIZE) {
					break;
				}
			}
		}
		return { hasMore: deleted === BOSS_TIMER_CLEANUP_BATCH_SIZE };
	}

	async function clearBossTimer(
		name: string,
		channelId: string,
		channels: number[]
	): Promise<void> {
		for (let i = timers.length; i--; i >= 0) {
			if (
				timers[i].name === name &&
				timers[i].channelId === channelId &&
				channels.includes(timers[i].channel)
			) {
				timers.splice(i, 1);
			}
		}
	}

	async function addBossTimers(newTimers: BossTimer[]): Promise<void> {
		timers.push(...newTimers);
	}

	async function markTimerReminderSent(
		name: string,
		channelId: string,
		channels: number[]
	): Promise<void> {
		for (const timer of timers) {
			if (
				timer.name === name &&
				timer.channelId === channelId &&
				channels.includes(timer.channel)
			) {
				timer.reminderSent = true;
			}
		}
	}

	return {
		getRemindersBefore,
		clearReminder,
		addReminder,

		getExistingTimers,
		clearStaleBossTimers,
		clearBossTimer,
		addBossTimers,
		markTimerReminderSent,
	};
}
