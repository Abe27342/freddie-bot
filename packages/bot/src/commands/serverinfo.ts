import {
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';

const MAPLELEGENDS_BASE_API = 'https://maplelegends.com';

async function getOnline(): Promise<number | undefined> {
	const url = new URL(`/api/get_online_users`, MAPLELEGENDS_BASE_API);
	const response = await fetch(url.href);
	if (!response.ok) {
		return undefined;
	}
	return (await response.json()).usercount;
}

async function getUniqueUsers(): Promise<
	{ daily: number; weekly: number; monthly: number } | undefined
> {
	const url = new URL(`/api/get_unique_users`, MAPLELEGENDS_BASE_API);
	const response = await fetch(url.href);
	if (!response.ok) {
		return undefined;
	}
	return await response.json();
}

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
