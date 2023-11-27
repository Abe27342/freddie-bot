import {
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { getOnline, getUniqueUsers } from './apis/index.js';

export const serverinfo: Command = {
	data: new SlashCommandBuilder()
		.setName('serverinfo')
		.setDescription('Get information about the current server state.')
		.addSubcommand((builder) =>
			builder
				.setName('online')
				.setDescription('Get the number of players online.')
		)
		.addSubcommand((builder) =>
			builder
				.setName('time')
				.setDescription('Get the current server time.')
		)
		.addSubcommand((builder) =>
			builder
				.setName('unique_users')
				.setDescription('Get the number of recent unique users.')
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		await interaction.deferReply();
		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case 'online': {
				const count = await getOnline();
				if (count === undefined) {
					await interaction.editReply('Error fetching online count.');
					return;
				} else {
					await interaction.editReply(
						`There are ${count} users online.`
					);
				}
				break;
			}
			case 'time': {
				await interaction.editReply(
					`Server time: ${new Date().toUTCString()}`
				);
				break;
			}
			case 'unique_users': {
				const userInfo = await getUniqueUsers();
				if (userInfo === undefined) {
					await interaction.editReply(
						'Error fetching unique user count.'
					);
				} else {
					await interaction.editReply(
						`There are currently ${userInfo.monthly} monthly, ${userInfo.weekly} weekly, and ${userInfo.daily} daily unique users.`
					);
				}
				break;
			}
			default:
				throw new Error(`Unknown subcommand ${subcommand}`);
		}
	},
};
