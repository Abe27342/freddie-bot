import {
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import type { FreddieBotClient, Reminder } from '../types';
import { Command } from './types';
import { parseTimeDelta } from '../utils/index.js';

const TIME_ARG = 'time_delta';
const MESSAGE_ARG = 'message';

export const remindme: Command = {
	data: new SlashCommandBuilder()
		.setName('remind')
		.addStringOption((builder) =>
			builder
				.setName(TIME_ARG)
				.setDescription(
					'Time until reminder. Example: 5d 3h 2m 30s for 5 days, 3 hours, 2 minutes, and 30 seconds from now.'
				)
				.setRequired(true)
		)
		.addStringOption((builder) =>
			builder
				.setName(MESSAGE_ARG)
				.setDescription('Reminder message')
				.setRequired(true)
		)
		.setDescription('Remind the user of something in the future.'),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const delta = parseTimeDelta(interaction.options.getString(TIME_ARG));
		if (!delta) {
			await interaction.reply({
				content: 'Invalid time delta.',
				ephemeral: true,
			});
			return;
		}

		if (delta > 1000 * 60 * 60 * 24 * 365 * 2) {
			await interaction.reply({
				content: 'Time delta must be less than 2 years.',
				ephemeral: true,
			});
			return;
		}
		const expiration = Date.now() + delta;
		const channelId = interaction.channelId;
		const message = `Remind <@${
			interaction.user.id
		}>:\n${interaction.options.getString(MESSAGE_ARG)}`;
		const reminder: Omit<Reminder, 'id'> = {
			expiration,
			channelId,
			message,
		};
		(interaction.client as FreddieBotClient).enqueueReminder(reminder);
		await interaction.reply({
			content: `Reminder set for <t:${Math.floor(expiration / 1000)}:f>.`,
		});
	},
};
