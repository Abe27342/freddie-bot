import type { Collection, Filter } from 'mongodb';
import type { CustomCommand } from '../commands/custom';
import type { CustomCommandStorage } from './index';

type CustomCommandCollection = Pick<
	Collection<CustomCommand>,
	'bulkWrite' | 'createIndexes' | 'find' | 'findOne'
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

	async function replaceCustomCommands(
		serverId: string,
		replacements: Omit<CustomCommand, 'serverId'>[]
	): Promise<void> {
		const commandNames = replacements.map(({ commandName }) => commandName);
		await commands.bulkWrite([
			...replacements.map(({ commandName, response }) => ({
				replaceOne: {
					filter: { serverId, commandName },
					replacement: { serverId, commandName, response },
					upsert: true,
				},
			})),
			{
				deleteMany: {
					filter: {
						serverId,
						commandName: { $nin: commandNames },
					},
				},
			},
		]);
	}

	return {
		getCustomCommands,
		getCustomCommand,
		replaceCustomCommands,
	};
}
