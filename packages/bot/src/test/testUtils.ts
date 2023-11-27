import { expect } from 'vitest';
import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { ChannelData, MockDiscord } from './mockDiscord.js';
import { FreddieBotClient } from '../client';
import * as commandsModule from '../commands/index.js';

// TODO: There's a lot of `any` in this file.

export const defaultConfig = {
	id: '11',
	lang: 'en',
	prefix: '.',
	almanaxChannel: 'almanax',
	partyChannel: 'listagem-de-grupos',
	buildPreview: 'enabled',
};

export const optionType: any = {
	// 0: null,
	// 1: subCommand,
	// 2: subCommandGroup,
	3: String,
	4: Number,
	5: Boolean,
	// 6: user,
	// 7: channel,
	// 8: role,
	// 9: mentionable,
	10: Number,
};

function getNestedOptions(options: any[]): any {
	return options.reduce((allOptions, optionable) => {
		const option = optionable.toJSON();
		if (!option.options) return [...allOptions, option];
		const nestedOptions = getNestedOptions(option.options);
		return [option, ...allOptions, ...nestedOptions];
	}, []);
}

function castToType(value: string, typeId: number) {
	const typeCaster = optionType[typeId];
	return typeCaster ? typeCaster(value) : value;
}

function getParsedCommand(
	stringCommand: string,
	commandData: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
) {
	const options = getNestedOptions(commandData.options);
	const optionsIndentifiers = options.map((option: any) => `${option.name}:`);
	const requestedOptions = options.reduce(
		(requestedOptions: any, option: any) => {
			const identifier = `${option.name}:`;
			if (!stringCommand.includes(identifier)) return requestedOptions;
			const remainder = stringCommand.split(identifier)[1];

			const nextOptionIdentifier = remainder
				.split(' ')
				.find((word) => optionsIndentifiers.includes(word));
			if (nextOptionIdentifier) {
				const value = remainder.split(nextOptionIdentifier)[0].trim();
				return [
					...requestedOptions,
					{
						name: option.name,
						value: castToType(value, option.type),
						type: option.type,
					},
				];
			}

			return [
				...requestedOptions,
				{
					name: option.name,
					value: castToType(remainder.trim(), option.type),
					type: option.type,
				},
			];
		},
		[]
	);
	const optionNames = options.map((option: any) => option.name);
	const splittedCommand = stringCommand.split(' ');
	const name = splittedCommand[0].replace('/', '');
	const subcommand = splittedCommand.find((word) =>
		optionNames.includes(word)
	);
	return {
		id: name,
		name,
		type: 1,
		options: subcommand
			? [
					{
						name: subcommand,
						type: 1,
						options: requestedOptions,
					},
			  ]
			: requestedOptions,
	};
}

const commands = Object.values(commandsModule);

export async function runCommand(
	command: string,
	client: FreddieBotClient,
	mockDiscord: MockDiscord,
	interactionSource?: ChannelData
): Promise<ChatInputCommandInteraction> {
	const [, commandName] = command.match(/\/([^ ]*).*/);
	const commandSchema = commands.find(
		(command) => command.data.name === commandName
	);
	expect(commandSchema).toBeDefined();
	const parsedCommand = getParsedCommand(command, commandSchema.data);
	const interaction = mockDiscord.createCommandInteraction(
		parsedCommand,
		interactionSource
	);
	client.emit('interactionCreate', interaction);
	await client.ensurePendingWorkProcessed();
	return interaction;
}

export async function runCommands(
	client: FreddieBotClient,
	mockDiscord: MockDiscord,
	commands: string[]
): Promise<ChatInputCommandInteraction[]> {
	const interactions: ChatInputCommandInteraction[] = [];
	for (const command of commands) {
		interactions.push(await runCommand(command, client, mockDiscord));
	}
	return interactions;
}
