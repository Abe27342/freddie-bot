import { Client, Collection, Interaction } from 'discord.js';
import type { Command } from './commands/types';
import type { InteractionHandler } from './interactions/types';
import { BossTimerStorage, FreddieBotDb } from './db';

export type AsyncWorkTypes = 'command' | 'boss-timer';

/**
 * Unique id for a database entry.
 * TODO: Rather than determine these client-side, we should be able to re-use cosmosDB-generated IDs
 * which is likely slightly cheaper.
 */
export type DbId = string & { _brand: 'ReminderId' };

export interface Reminder {
	/**
	 * Unique id for this reminder.
	 */
	id: DbId;
	/**
	 * Ms past epoch when the reminder should be sent.
	 */
	expiration: number;
	/**
	 * Channel ID to send the reminder to.
	 */
	channelId: string;
	/**
	 * Message contents of the reminder.
	 */
	message: string;
}

export interface BossTimer {
	/**
	 * Boss name.
	 */
	name: string;
	/**
	 * Channel ID to send the timer reminder to.
	 */
	channelId: string;
	/**
	 * Ms past epoch when the boss may start spawning.
	 */
	expiration: number;

	/**
	 * Channel the boss is spawning in.
	 */
	channel: number;

	/**
	 * Whether a reminder has already been sent for this timer.
	 */
	reminderSent?: boolean;
}

export interface ClientOptions {
	/**
	 * Discord token to use for login.
	 */
	token: string;

	/**
	 * List of server IDs that the bot should process interactions on.
	 * If undefined, the bot will process interactions on all servers it is a member of.
	 */
	allowList?: string[];

	/**
	 * List of server IDs that the bot should ignore interactions on.
	 */
	blockList?: string[];

	/**
	 * Optional base discord client to use rather than initializing a new one.
	 *
	 * This is primarily useful for tests to set up mocks.
	 */
	baseClient?: Client;

	/**
	 * Database to use for persisted data.
	 */
	db: FreddieBotDb;

	/**
	 * Policy to apply when errors are encountered in interactions or events.
	 *
	 * By default, errors are logged to the console and the user is notified of the error
	 * when the user was performing an interaction.
	 * @returns
	 */
	onError?: (
		error: Error,
		source: AsyncWorkTypes,
		interaction?: Interaction
	) => Promise<void>;
}

export interface FreddieBotClient extends Client<boolean> {
	commands: Collection<string, Command>;
	interactions: Collection<string, InteractionHandler>;

	/**
	 * Pushes a set of asynchronous work onto the client.
	 * Errors will be surfaced as determined by {@link ClientOptions.onError}.
	 */
	pushAsyncWork(
		name: AsyncWorkTypes,
		work: Promise<unknown>,
		interaction?: Interaction
	): void;

	/**
	 * Ensures all pending interactions/commands have been processed.
	 *
	 * This is immediately useful for tests, but may also be useful in the future for production in cases like:
	 * - Graceful shutdown
	 * - Avoiding interleaving of synchronization between fluid file and discord: there are likely race conditions
	 *   in the current logic that are rare enough to not have yet caused issues.
	 *
	 * TODO: maybe want a variant with allSettled instead of 'all'
	 */
	ensurePendingWorkProcessed(): Promise<void>;

	enqueueReminder(reminder: Omit<Reminder, 'id'>): void;

	bosses: BossTimerStorage;
}
