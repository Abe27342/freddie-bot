/**
 * Implements a simple queue for reminder tasks.
 */

import { Client } from 'discord.js';
import { Random, MersenneTwister19937 } from 'random-js';
import { Reminder, ReminderId } from './types';
import { FreddieBotDb } from './db';

const random = new Random(MersenneTwister19937.autoSeed());

export interface ReminderQueue {
	setReminder(reminder: Omit<Reminder, 'id'>): Promise<ReminderId>;
	clearReminder(id: ReminderId): void;
}

export interface ReminderQueueOptions {
	/**
	 * Interval in ms to query the database for reminders.
	 */
	queryInterval: number;
}

export function createReminderQueue(
	client: Client,
	db: FreddieBotDb,
	options: ReminderQueueOptions
): ReminderQueue {
	const reminderIdToTimeoutId = new Map<ReminderId, NodeJS.Timeout>();

	async function setReminder(
		reminder: Omit<Reminder, 'id'>
	): Promise<ReminderId> {
		const id = random.uuid4() as ReminderId;
		const remainingTime = reminder.expiration - Date.now();
		// If reminder isn't happening for a while, don't bother keeping it around in memory.
		if (remainingTime < 2 * options.queryInterval) {
			setReminderTimeout({ ...reminder, id });
		}
		await db.addReminder({ ...reminder, id });
		return id;
	}

	function setReminderTimeout(reminder: Reminder): void {
		const timeoutId = setTimeout(
			() => sendReminder(reminder),
			reminder.expiration - Date.now()
		);
		reminderIdToTimeoutId.set(reminder.id, timeoutId);
	}

	async function clearReminder(id: ReminderId): Promise<void> {
		await db.clearReminder(id);
		const timeoutId = reminderIdToTimeoutId.get(id);
		if (timeoutId) {
			clearTimeout(timeoutId);
			reminderIdToTimeoutId.delete(id);
		}
	}

	async function sendReminder(reminder: Reminder): Promise<void> {
		try {
			const channel = await client.channels.fetch(reminder.channelId);
			if (!channel.isTextBased()) {
				return;
			}

			await channel.send(reminder.message);
		} catch (error) {
			// TODO: This can make us not send reminders that we should be sending to people. On the other hand,
			// not tolerating some errors here can cause leaks in the database, as e.g. the bot could have been
			// kicked from the server it's supposed to message.
			console.log(
				error,
				'Error sending reminder to: ' + reminder.channelId
			);
			throw error;
		} finally {
			await db.clearReminder(reminder.id);
			reminderIdToTimeoutId.delete(reminder.id);
		}
	}

	async function fetchVirtualizedReminders(): Promise<void> {
		const reminders = await db.getRemindersBefore(
			Date.now() + 1.5 * options.queryInterval
		);

		for (const reminder of reminders) {
			if (!reminderIdToTimeoutId.has(reminder.id)) {
				setReminderTimeout(reminder);
			}
		}
	}

	// Once client is able to send messages, fetch reminders that might have lapsed during startup.
	client.once('ready', fetchVirtualizedReminders);
	setInterval(fetchVirtualizedReminders, options.queryInterval);

	return { setReminder, clearReminder };
}
