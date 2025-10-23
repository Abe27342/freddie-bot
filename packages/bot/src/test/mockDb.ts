import { FreddieBotDb } from '../db';
import { Reminder, DbId, BossTimer } from '../types';

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

	async function getExistingTimers(): Promise<BossTimer[]> {
		return [...timers];
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
		clearBossTimer,
		addBossTimers,
		markTimerReminderSent,
	};
}
