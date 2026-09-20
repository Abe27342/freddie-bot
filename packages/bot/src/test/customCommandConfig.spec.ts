import { describe, expect, it } from 'vitest';
import {
	createCustomCommandConfig,
	createCustomCommands,
	parseCustomCommandConfig,
} from '../customCommandConfig';

describe('custom command configuration', () => {
	it('converts a response map to server-scoped database records', () => {
		const config = parseCustomCommandConfig(
			'{"alpha":"first response","beta":"second response"}'
		);

		expect(createCustomCommands('guild-id', config)).toEqual([
			{
				serverId: 'guild-id',
				commandName: 'alpha',
				response: 'first response',
			},
			{
				serverId: 'guild-id',
				commandName: 'beta',
				response: 'second response',
			},
		]);
	});

	it('rejects non-string responses', () => {
		expect(() =>
			parseCustomCommandConfig('{"alpha":{"content":"response"}}')
		).toThrow('Response for custom command "alpha" must be a string.');
	});

	it('rejects responses that Discord cannot send', () => {
		expect(() => parseCustomCommandConfig('{"alpha":""}')).toThrow(
			'must contain 1-2000 characters'
		);
		expect(() =>
			parseCustomCommandConfig(
				JSON.stringify({ alpha: 'a'.repeat(2001) })
			)
		).toThrow('must contain 1-2000 characters');
	});

	it('rejects more than 80 custom commands', () => {
		const config = Object.fromEntries(
			Array.from({ length: 81 }, (_, index) => [
				`command-${index}`,
				'response',
			])
		);
		expect(() => parseCustomCommandConfig(JSON.stringify(config))).toThrow(
			'at most 80 custom commands'
		);
	});

	it('exports commands as a sorted response map without database fields', () => {
		expect(
			createCustomCommandConfig([
				{
					serverId: 'guild-id',
					commandName: 'beta',
					response: 'second response',
				},
				{
					serverId: 'guild-id',
					commandName: 'alpha',
					response: 'first response',
				},
			])
		).toEqual({
			alpha: 'first response',
			beta: 'second response',
		});
	});
});
