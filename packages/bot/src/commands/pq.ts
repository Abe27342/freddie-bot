import {
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { cwkpq } from './cwkpq.js';
import { PLAYERS_ARG } from './shared-args.js';

export const apq: Command = {
	data: new SlashCommandBuilder()
		.setName('pq')
		.setDescription('Get infographics for Maplestory PQs.')
		.addSubcommand((builder) =>
			builder.setName('apq').setDescription('Amoria Party Quest')
		)
		.addSubcommand((builder) =>
			builder.setName('lpq').setDescription('Ludibrium Party Quest')
		)
		.addSubcommand((builder) =>
			builder.setName('opq').setDescription('Orbis Party Quest')
		)
		.addSubcommand((builder) =>
			builder
				.setName('cwkpq')
				.setDescription('Crimsonwood Keep Party Quest')
				.addNumberOption((builder) =>
					builder
						.setName(PLAYERS_ARG)
						.setDescription('Number of players looting boxes')
						.setMinValue(3)
						.setMaxValue(10)
						.setRequired(true)
				)
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case 'apq':
			case 'opq': {
				const embed = new EmbedBuilder().setImage(
					'https://i.imgur.com/25NBdNv.gif'
				);
				await interaction.reply({ embeds: [embed] });
				break;
			}
			case 'lpq': {
				const embed = new EmbedBuilder()
					.setTitle('Ludibrium Party Quest')
					.setDescription(
						`[Guide](https://mapleroyals.com/forum/threads/ludibrium-party-quest-lpq-guide.108791/)`
					)
					.setImage('https://image.ibb.co/jmXUry/Movement.png')
					.addFields({
						name: 'Stage 6 code',
						value: '133 221 333 123 111',
						inline: true,
					});
				await interaction.reply({ embeds: [embed] });
				break;
			}
			case 'cwkpq': {
				await cwkpq.execute(interaction);
				break;
			}
			default:
				throw new Error(`Unknown subcommand: ${subcommand}`);
		}
	},
};
