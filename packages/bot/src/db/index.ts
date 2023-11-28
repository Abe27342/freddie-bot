import { MongoClient } from 'mongodb';
import { Reminder, ReminderId } from '../types';
import { dirname } from 'path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
dotenv.config({
	path: `${dirname(fileURLToPath(import.meta.url))}/../../../.env`,
});

export interface FreddieBotDb {
	getRemindersBefore(time: number): Promise<Reminder[]>;
	clearReminder(id: ReminderId): Promise<void>;
	addReminder(reminder: Reminder): Promise<void>;
}

export async function createDb(): Promise<FreddieBotDb> {
	const qsp = new URLSearchParams({
		ssl: 'true',
		retrywrites: 'false',
		maxIdleTimeMS: '120000',
		appName: '@freddie-bot-db@',
	});
	const connectionString = `mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/?${qsp}`;
	const client = new MongoClient(connectionString);

	await client.connect();
	console.log('Connected to database.');
	const db = client.db(
		process.env.MONGODB_PREPRODUCTION
			? 'freddie-bot-db-preprod'
			: 'freddie-bot-db'
	);
	const reminders = db.collection<Reminder>('reminders');

	async function getRemindersBefore(time: number): Promise<Reminder[]> {
		const result = await reminders
			.find({ expiration: { $lt: time } })
			.toArray();
		return result;
	}

	async function clearReminder(id: ReminderId): Promise<void> {
		await reminders.deleteMany({ id });
	}

	async function addReminder(reminder: Reminder): Promise<void> {
		await reminders.insertOne(reminder);
	}

	return {
		getRemindersBefore,
		clearReminder,
		addReminder,
	};
}
