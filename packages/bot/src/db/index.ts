import { MongoClient } from 'mongodb';
import { BossTimer, Reminder, DbId } from '../types';
import { dirname } from 'path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
dotenv.config({
	path: `${dirname(fileURLToPath(import.meta.url))}/../../../.env`,
});

export interface BossTimerStorage {
	addBossTimers(timer: BossTimer[]): Promise<void>;
	getExistingTimers(): Promise<BossTimer[]>;
	clearBossTimer(
		name: string,
		channelId: string,
		channels: number[]
	): Promise<void>;
	markTimerReminderSent(
		name: string,
		channelId: string,
		channels: number[]
	): Promise<void>;
}

export interface FreddieBotDb extends BossTimerStorage {
	getRemindersBefore(time: number): Promise<Reminder[]>;
	clearReminder(id: DbId): Promise<void>;
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
	const timers = db.collection<BossTimer>('boss-timers');

	async function getRemindersBefore(time: number): Promise<Reminder[]> {
		const result = await reminders
			.find({ expiration: { $lt: time } })
			.toArray();
		return result;
	}

	async function clearReminder(id: DbId): Promise<void> {
		await reminders.deleteMany({ id });
	}

	async function addReminder(reminder: Reminder): Promise<void> {
		await reminders.insertOne(reminder);
	}

	async function getExistingTimers(): Promise<BossTimer[]> {
		const result = await timers.find().toArray();
		return result;
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
		await timers.insertMany(timersToInsert);
	}

	async function markTimerReminderSent(
		name: string,
		channelId: string,
		channels: number[]
	): Promise<void> {
		await timers.updateMany(
			{
				name,
				channelId,
				channel: { $in: channels },
			},
			{
				$set: { reminderSent: true },
			}
		);
	}

	// Clear stale timers (>7 days old) on startup.
	await timers.deleteMany({
		expiration: { $lt: Date.now() - 1000 * 60 * 60 * 24 * 7 },
	});

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
