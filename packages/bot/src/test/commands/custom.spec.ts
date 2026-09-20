import { describe, expect, it, vi } from 'vitest';
import {
	createCustomCommandData,
	executeCustomCommand,
} from '../../commands/custom';
import { createClient } from '../../client';
import { makeMockDb } from '../mockDb';
import { MockDiscord } from '../mockDiscord';

describe('custom command', () => {
	it('builds a top-level command without embedding response data', () => {
		const command = createCustomCommandData({
			commandName: 'alpha',
			serverId: 'guild-id',
			response: 'sensitive alpha response',
			description: 'Alpha help',
		}).toJSON();

		expect(command.name).toBe('alpha');
		expect(command.description).toBe('Alpha help');
		expect(command.options).toEqual([]);
		expect(JSON.stringify(command)).not.toContain('sensitive');
	});

	it('dispatches a top-level custom command and loads its guild response', async () => {
		const mockDiscord = new MockDiscord();
		const db = makeMockDb({
			customCommands: [
				{
					commandName: 'alpha',
					serverId: 'guild-id',
					response: 'database response',
				},
			],
		});
		const client = await createClient({
			token: 'mock-token',
			baseClient: mockDiscord.getClient(),
			db,
		});
		const interaction = mockDiscord.createCommandInteraction({
			id: 'alpha',
			name: 'alpha',
			type: 1,
			options: [],
		});

		client.emit('interactionCreate', interaction);
		await client.ensurePendingWorkProcessed();

		expect(interaction.reply).toHaveBeenCalledWith('database response');
	});

	it('reports configuration drift without exposing another response', async () => {
		const mockDiscord = new MockDiscord();
		const db = makeMockDb();
		const getCustomCommand = vi.spyOn(db, 'getCustomCommand');
		Object.assign(mockDiscord.getClient(), { customCommands: db });
		const interaction = mockDiscord.createCommandInteraction({
			id: 'missing',
			name: 'missing',
			type: 1,
			options: [],
		});

		await executeCustomCommand(interaction);

		expect(getCustomCommand).toHaveBeenCalledWith('guild-id', 'missing');
		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'This command is no longer configured.',
			ephemeral: true,
		});
	});
});
