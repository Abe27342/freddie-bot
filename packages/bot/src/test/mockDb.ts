import { BossTimerQuery, FreddieBotDb } from '../db';
import { Reminder, DbId, BossTimer } from '../types';
import type { CustomCommand } from '../commands/custom';

export function makeMockDb({
	reminders = [],
	timers = [],
	customCommands = [],
}: {
	reminders?: Reminder[];
	timers?: BossTimer[];
	customCommands?: CustomCommand[];
} = {}): FreddieBotDb {
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
				timer.expiration !== undefined &&
				timer.name !== undefined &&
				(query.name === undefined || timer.name === query.name) &&
				(query.channelId === undefined ||
					timer.channelId === query.channelId) &&
				(!query.pendingOnly || !timer.reminderSent)
		);
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

	async function getCustomCommands(
		serverId?: string
	): Promise<CustomCommand[]> {
		return customCommands.filter(
			(command) => serverId === undefined || command.serverId === serverId
		);
	}

	async function getCustomCommand(
		serverId: string,
		commandName: string
	): Promise<CustomCommand | null> {
		return (
			customCommands.find(
				(command) =>
					command.serverId === serverId &&
					command.commandName === commandName
			) ?? null
		);
	}

	async function replaceCustomCommands(
		serverId: string,
		replacements: Omit<CustomCommand, 'serverId'>[]
	): Promise<void> {
		for (let index = customCommands.length - 1; index >= 0; index--) {
			if (customCommands[index].serverId === serverId) {
				customCommands.splice(index, 1);
			}
		}
		customCommands.push(
			...replacements.map((command) => ({ ...command, serverId }))
		);
	}

	return {
		getRemindersBefore,
		clearReminder,
		addReminder,

		getExistingTimers,
		clearBossTimer,
		addBossTimers,
		markTimerReminderSent,

		getCustomCommands,
		getCustomCommand,
		replaceCustomCommands,
		close: async () => {},
	};
}
