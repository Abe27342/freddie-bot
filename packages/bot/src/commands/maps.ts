import {
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';

const staticAssetNames: Record<string, string> = {
	hh: 'https://i.imgur.com/qq8DFT5.png',
	ninja_castle: 'https://i.imgur.com/0PYo0Fp.png',
};

export const maps: Command = {
	data: new SlashCommandBuilder()
		.setName('maps')
		.setDescription('Get infographics for hard-to-navigate maple areas.')
		.addSubcommand((builder) =>
			builder.setName('hh').setDescription('Haunted Forest map')
		)
		.addSubcommand((builder) =>
			builder.setName('ninja_castle').setDescription('Ninja Castle map')
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const subcommand = interaction.options.getSubcommand();
		const url = staticAssetNames[subcommand];
		if (url !== undefined) {
			const embed = new EmbedBuilder().setImage(url);
			await interaction.reply({ embeds: [embed] });
			return;
		}
		await interaction.reply('Map not found.');
	},
};
