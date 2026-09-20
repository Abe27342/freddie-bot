import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { FreddieBotClient } from '../types';

/** Persisted custom command data */
export interface CustomCommand {
	/** Name of the custom command */
	commandName: string;
	/** Which Discord server this command belongs to */
	serverId: string;
	/** Content of the bot response when command is invoked */
	response: string;
	/** Description of what this command does. Appears in the slash command invoke menu. */
	description?: string;
}

export function createCustomCommandData(
	data: CustomCommand
): SlashCommandBuilder {
	return new SlashCommandBuilder()
		.setName(data.commandName)
		.setDescription(
			data.description ?? `Get information about ${data.commandName}.`
		);
}

export async function executeCustomCommand(
	interaction: ChatInputCommandInteraction
): Promise<void> {
	if (interaction.guildId === null) {
		await interaction.reply({
			content: 'This command is only available in a server.',
			ephemeral: true,
		});
		return;
	}

	const customCommand = await (
		interaction.client as FreddieBotClient
	).customCommands.getCustomCommand(
		interaction.guildId,
		interaction.commandName
	);

	if (customCommand === null) {
		await interaction.reply({
			content: 'This command is no longer configured.',
			ephemeral: true,
		});
		return;
	}

	await interaction.reply(customCommand.response);
}
