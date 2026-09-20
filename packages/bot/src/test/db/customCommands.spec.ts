import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomCommandStorage } from '../../db/customCommands';
import type { CustomCommandStorage } from '../../db';

describe('custom command storage', () => {
	const cursor = {
		toArray: vi.fn(),
	};
	const collection = {
		createIndexes: vi.fn(),
		find: vi.fn(),
		findOne: vi.fn(),
		bulkWrite: vi.fn(),
	};
	let storage: CustomCommandStorage;

	beforeEach(async () => {
		vi.resetAllMocks();
		cursor.toArray.mockResolvedValue([]);
		collection.find.mockReturnValue(cursor);
		storage = await createCustomCommandStorage(collection);
	});

	it('enforces one command name per server', () => {
		expect(collection.createIndexes).toHaveBeenCalledWith([
			{ key: { serverId: 1, commandName: 1 }, unique: true },
		]);
	});

	it('can list every command or commands for one server', async () => {
		await storage.getCustomCommands();
		expect(collection.find).toHaveBeenCalledWith({});

		await storage.getCustomCommands('guild-id');
		expect(collection.find).toHaveBeenLastCalledWith({
			serverId: 'guild-id',
		});
	});

	it('looks up an invocation by server and subcommand name', async () => {
		collection.findOne.mockResolvedValue({
			serverId: 'guild-id',
			commandName: 'alpha',
			response: 'response',
		});

		await expect(
			storage.getCustomCommand('guild-id', 'alpha')
		).resolves.toMatchObject({ response: 'response' });
		expect(collection.findOne).toHaveBeenCalledWith({
			serverId: 'guild-id',
			commandName: 'alpha',
		});
	});

	it('upserts desired commands and deletes stale commands for only that server', async () => {
		await storage.replaceCustomCommands('guild-id', [
			{ commandName: 'alpha', response: 'new alpha' },
			{ commandName: 'beta', response: 'new beta' },
		]);

		expect(collection.bulkWrite).toHaveBeenCalledWith([
			{
				replaceOne: {
					filter: {
						serverId: 'guild-id',
						commandName: 'alpha',
					},
					replacement: {
						serverId: 'guild-id',
						commandName: 'alpha',
						response: 'new alpha',
					},
					upsert: true,
				},
			},
			{
				replaceOne: {
					filter: {
						serverId: 'guild-id',
						commandName: 'beta',
					},
					replacement: {
						serverId: 'guild-id',
						commandName: 'beta',
						response: 'new beta',
					},
					upsert: true,
				},
			},
			{
				deleteMany: {
					filter: {
						serverId: 'guild-id',
						commandName: { $nin: ['alpha', 'beta'] },
					},
				},
			},
		]);
	});
});
