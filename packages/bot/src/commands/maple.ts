import {
	AttachmentBuilder,
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import * as path from 'path';
import { promises as fs } from 'fs';
import { Command } from './types';
import {
	getCharacterAvatar,
	getCharacterStats,
	isUnbanned,
} from './apis/index.js';

const NAME_ARG = 'name';

let assetsEnsured = false;
export const maple: Command = {
	data: new SlashCommandBuilder()
		.setName('maple')
		.addStringOption((builder) =>
			builder
				.setName(NAME_ARG)
				.setDescription('Character name')
				.setMinLength(4)
				.setMaxLength(12)
				.setRequired(true)
		)
		.setDescription('Fetches a snapshot of the provided character'),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		await interaction.deferReply();
		const name = interaction.options.getString(NAME_ARG);

		const [stats, avatarInfo] = await Promise.all([
			getCharacterStats(name),
			getCharacterAvatar(name),
		]);
		if (!stats || !avatarInfo) {
			await interaction.editReply({
				content: 'Character not found.',
			});
			return;
		}
		const dir = './assets';
		const filename = `${name}-${Date.now()}.png`;
		if (!assetsEnsured) {
			await fs.mkdir(dir, { recursive: true });
			assetsEnsured = true;
		}
		const fullFilename = path.join(dir, filename);
		await fs.writeFile(fullFilename, Buffer.from(avatarInfo.avatar));

		const file = new AttachmentBuilder(fullFilename);
		const embed = new EmbedBuilder()
			.setTitle(stats.name ?? name)
			.setImage(`attachment://${filename}`);
		if (isUnbanned(stats)) {
			embed.addFields(
				{ name: 'Level', value: `${stats.level}`, inline: true },
				{
					name: 'Exp',
					value: !stats.exp ? '0.00%' : stats.exp,
					inline: true,
				},
				{ name: 'Fame', value: `${stats.fame}`, inline: true },
				{ name: 'Cards', value: `${stats.cards}`, inline: true },
				{ name: 'Quests', value: `${stats.quests}`, inline: true },
				{ name: 'Job', value: stats.job, inline: true },
				{
					name: 'Guild',
					value: !stats.guild ? 'N/A' : stats.guild,
					inline: true,
				}
			);
		}

		await interaction.editReply({
			embeds: [embed],
			files: [file],
		});
		await fs.rm(fullFilename);
	},
};
