import { ButtonInteraction } from 'discord.js';
import { InteractionHandler } from './types';
import { FreddieBotClient } from '../types';
import {
	addBossTimerForChannel,
	bosses,
	getTimerAggregatorForChannel,
	buildBossTimerMessage,
	ML_CHANNELS,
} from '../commands/bosstimer-helper.js';

export const bosstimerAdd: InteractionHandler = {
	name: 'bosstimer_add',
	async execute(interaction: ButtonInteraction) {
		// Parse the custom ID to extract boss name and channel
		// Format: "bosstimer_add|{bossName}_{channel}"
		const [interactionType, args] = interaction.customId.split('|');
		const parts = args.split('_');
		if (parts.length !== 2 || interactionType !== 'bosstimer_add') {
			await interaction.reply({
				content: 'Invalid button interaction.',
				ephemeral: true,
			});
			return;
		}

		const bossName = parts[0];
		const channel = parseInt(parts[1], 10);

		if (isNaN(channel) || channel < 1 || channel > ML_CHANNELS) {
			await interaction.reply({
				content: 'Invalid channel number.',
				ephemeral: true,
			});
			return;
		}

		const client = interaction.client as FreddieBotClient;
		const channelId = interaction.channelId;

		try {
			await addBossTimerForChannel(client, channelId, bossName, channel);

			// Get the updated timers and respawn cooldown
			const respawnCooldownMs = bosses.get(bossName)!;

			// Fetch all timers for this boss from the database to include expired ones
			const allTimers = await client.bosses.getExistingTimers();
			const timers = allTimers
				.filter((t) => t.name === bossName && t.channelId === channelId)
				.map((t) => ({
					channel: t.channel,
					expiration: t.expiration,
					reminderSent: t.reminderSent,
				}));

			// Build the updated message
			const { content, components } = buildBossTimerMessage(
				bossName,
				timers,
				respawnCooldownMs
			);

			// Update the original message to reflect the new timer status
			await interaction.update({
				content,
				components,
			});
		} catch (error) {
			if (error.message.includes('Timer already exists')) {
				await interaction.reply({
					content: `A timer for ${bossName} in channel ${channel} already exists.`,
					ephemeral: true,
				});
				return;
			}
			console.error('Error adding boss timer:', error);
			await interaction.reply({
				content:
					'Failed to add timer. Please manually add with /bosstimer add.',
				ephemeral: true,
			});
		}
	},
};
