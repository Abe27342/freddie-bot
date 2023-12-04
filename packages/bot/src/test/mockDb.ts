import { FreddieBotDb } from '../db';
import { Reminder, DbId, BossTimer } from '../types';

export function makeMockDb(state: Reminder[] = []): FreddieBotDb {
	const reminders = state;

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
		throw new Error('not implemented');
	}

	async function clearBossTimer(id: DbId): Promise<void> {
		throw new Error('not implemented');
	}

	async function addBossTimers(timers: BossTimer[]): Promise<void> {
		throw new Error('not implemented');
	}

	return {
		getRemindersBefore,
		clearReminder,
		addReminder,

		getExistingTimers,
		clearBossTimer,
		addBossTimers,
	};
}
