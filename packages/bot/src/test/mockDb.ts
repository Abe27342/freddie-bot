import { FreddieBotDb } from '../db';
import { Reminder, ReminderId } from '../types';

export function makeMockDb(state: Reminder[] = []): FreddieBotDb {
	const reminders = state;

	async function getRemindersBefore(time: number): Promise<Reminder[]> {
		return reminders.filter((reminder) => reminder.expiration < time);
	}

	async function clearReminder(id: ReminderId): Promise<void> {
		for (let i = reminders.length; i--; i >= 0) {
			if (reminders[i].id === id) {
				reminders.splice(i, 1);
			}
		}
	}

	async function addReminder(reminder: Reminder): Promise<void> {
		reminders.push(reminder);
	}
	return {
		getRemindersBefore,
		clearReminder,
		addReminder,
	};
}
