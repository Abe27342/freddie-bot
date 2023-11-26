import type {
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
	ChatInputCommandInteraction,
} from 'discord.js';

export interface Command {
	data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
	testServerOnly?: boolean; // defaults to false
	adminOnly?: boolean; // defaults to false
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
