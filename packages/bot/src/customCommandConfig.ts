import type { CustomCommand } from './commands/custom';

export type CustomCommandConfig = Record<string, string>;
export const MAX_CUSTOM_COMMANDS_PER_SERVER = 80;
export const MAX_CUSTOM_COMMAND_RESPONSE_LENGTH = 2000;

export function parseCustomCommandConfig(json: string): CustomCommandConfig {
	const parsed: unknown = JSON.parse(json);
	if (
		parsed === null ||
		typeof parsed !== 'object' ||
		Array.isArray(parsed)
	) {
		throw new Error(
			'Custom command data must be a JSON object mapping command names to responses.'
		);
	}

	const config: CustomCommandConfig = {};
	for (const [commandName, response] of Object.entries(parsed)) {
		if (typeof response !== 'string') {
			throw new Error(
				`Response for custom command "${commandName}" must be a string.`
			);
		}
		if (
			response.length === 0 ||
			response.length > MAX_CUSTOM_COMMAND_RESPONSE_LENGTH
		) {
			throw new Error(
				`Response for custom command "${commandName}" must contain 1-${MAX_CUSTOM_COMMAND_RESPONSE_LENGTH} characters.`
			);
		}
		config[commandName] = response;
	}
	if (Object.keys(config).length > MAX_CUSTOM_COMMANDS_PER_SERVER) {
		throw new Error(
			`A server can have at most ${MAX_CUSTOM_COMMANDS_PER_SERVER} custom commands.`
		);
	}

	return config;
}

export function createCustomCommands(
	serverId: string,
	config: CustomCommandConfig
): CustomCommand[] {
	return Object.entries(config).map(([commandName, response]) => ({
		commandName,
		serverId,
		response,
	}));
}

export function createCustomCommandConfig(
	commands: CustomCommand[]
): CustomCommandConfig {
	return Object.fromEntries(
		[...commands]
			.sort((a, b) => a.commandName.localeCompare(b.commandName))
			.map(({ commandName, response }) => [commandName, response])
	);
}
