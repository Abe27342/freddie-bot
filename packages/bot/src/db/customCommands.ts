import type { Collection, Filter } from 'mongodb';
import type { CustomCommand } from '../commands/custom';
import type { CustomCommandStorage } from './index';

type CustomCommandCollection = Pick<
	Collection<CustomCommand>,
	'createIndexes' | 'find' | 'findOne'
>;

export async function createCustomCommandStorage(
	commands: CustomCommandCollection
): Promise<CustomCommandStorage> {
	await commands.createIndexes([
		{ key: { serverId: 1, commandName: 1 }, unique: true },
	]);

	async function getCustomCommands(
		serverId?: string
	): Promise<CustomCommand[]> {
		const filter: Filter<CustomCommand> =
			serverId === undefined ? {} : { serverId };
		return commands.find(filter).toArray();
	}

	async function getCustomCommand(
		serverId: string,
		commandName: string
	): Promise<CustomCommand | null> {
		return commands.findOne({ serverId, commandName });
	}

	return { getCustomCommands, getCustomCommand };
}
