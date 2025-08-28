import type {
	AutocompleteInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
	ChatInputCommandInteraction,
	SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import { FreddieBotClient } from '../types';

export interface Command {
	data:
		| SlashCommandBuilder
		| SlashCommandSubcommandsOnlyBuilder
		| SlashCommandOptionsOnlyBuilder;
	testServerOnly?: boolean; // defaults to false
	adminOnly?: boolean; // defaults to false
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
	autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
	initialize?(client: FreddieBotClient): Promise<void>;
}
