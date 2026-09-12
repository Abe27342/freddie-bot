import { MongoClient } from 'mongodb';
import { BossTimer, Reminder, DbId } from '../types';
import { dirname } from 'path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { createBossTimerStorage } from './bossTimers.js';
dotenv.config({
	path: `${dirname(fileURLToPath(import.meta.url))}/../../../.env`,
});

export interface BossTimerStorage {
	addBossTimers(timer: BossTimer[]): Promise<void>;
	getExistingTimers(query?: BossTimerQuery): Promise<BossTimer[]>;
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

export interface BossTimerQuery {
	name?: string;
	channelId?: string;
	pendingOnly?: boolean;
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
	const bossTimerStorage = await createBossTimerStorage(
		db.collection<BossTimer>('boss-timers')
	);

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

	return {
		getRemindersBefore,
		clearReminder,
		addReminder,

		...bossTimerStorage,
	};
}
