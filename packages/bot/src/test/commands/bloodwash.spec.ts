import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { createClient } from '../../client';
import { FreddieBotClient } from '../../types';
import { IServerState, MockDiscord } from '../mockDiscord';
import { runCommand } from '../testUtils';
import { makeMockDb } from '../mockDb';

describe('bloodwash', () => {
	const asyncErrors: any[] = [];
	let mockDiscord: MockDiscord;
	let serverState: IServerState;
	let client: FreddieBotClient;

	beforeEach(async () => {
		mockDiscord = new MockDiscord();
		serverState = mockDiscord.serverState;
		client = createClient({
			token: 'mock-token',
			baseClient: mockDiscord.getClient(),
			db: makeMockDb(),
			onError: async (error) => {
				asyncErrors.push({ error, stack: error.stack });
			},
		});
	});

	afterEach(() => {
		vi.resetAllMocks();
		expect(asyncErrors).toEqual([]);
		asyncErrors.length = 0;
	});

	it('works on a character under level 70', async () => {
		const interaction = await runCommand(
			'/bloodwash level: 10 str: 4 dex: 4 int: 25 luk: 4',
			client,
			mockDiscord
		);
		expect(interaction.reply).toHaveBeenCalledWith(
			'You have 33 AP assigned on HP/MP.'
		);
	});

	it('works on a character between 70 and 120', async () => {
		const interaction = await runCommand(
			'/bloodwash level: 71 str: 4 dex: 4 int: 25 luk: 4',
			client,
			mockDiscord
		);
		expect(interaction.reply).toHaveBeenCalledWith(
			'You have 343 AP assigned on HP/MP.'
		);
	});

	it('works on a character above level 120', async () => {
		const interaction = await runCommand(
			'/bloodwash level: 200 str: 4 dex: 4 int: 25 luk: 4',
			client,
			mockDiscord
		);
		expect(interaction.reply).toHaveBeenCalledWith(
			'You have 993 AP assigned on HP/MP.'
		);
	});
});
