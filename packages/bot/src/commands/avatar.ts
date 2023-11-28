import {
	AttachmentBuilder,
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';

const USER_ARG = 'user';

export const avatar: Command = {
	data: new SlashCommandBuilder()
		.setName('avatar')
		.addUserOption((builder) =>
			builder
				.setName(USER_ARG)
				.setDescription('User to fetch avatar for')
				.setRequired(true)
		)
		.setDescription("Show a user's avatar."),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const user = interaction.options.getUser(USER_ARG);
		const url = user.avatarURL({ forceStatic: true, size: 512 });
		const file = new AttachmentBuilder(url);
		await interaction.reply({
			content: `Avatar of ${user.displayName}`,
			files: [file],
		});
	},
};
