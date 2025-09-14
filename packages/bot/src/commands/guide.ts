import {
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { cwkpq } from './cwkpq.js';
import { PLAYERS_ARG } from './shared-args.js';

const staticAssetNames: Record<string, string> = {
	apqbonus: 'https://i.imgur.com/g7frMgb.png',
	apq: 'https://i.imgur.com/25NBdNv.gif',
	opq: 'https://i.imgur.com/25NBdNv.gif',
	hpq: 'https://i.imgur.com/XntImh2.png',
	hh: 'https://i.imgur.com/qq8DFT5.png',
	ninja_castle: 'https://i.imgur.com/0PYo0Fp.png',
	zpq: 'https://i.imgur.com/vpBfv6U.png',
};

export const guide: Command = {
	data: new SlashCommandBuilder()
		.setName('guide')
		.setDescription(
			'Get infographics for Maplestory PQs, prequests, and maps.'
		)
		.addSubcommand((builder) =>
			builder.setName('apqbonus').setDescription('APQ bonus stage')
		)
		.addSubcommand((builder) =>
			builder.setName('apq').setDescription('Amoria Party Quest')
		)
		.addSubcommand((builder) =>
			builder.setName('gpq').setDescription('Guild Party Quest')
		)
		.addSubcommand((builder) =>
			builder.setName('lpq').setDescription('Ludibrium Party Quest')
		)
		.addSubcommand((builder) =>
			builder.setName('opq').setDescription('Orbis Party Quest')
		)
		.addSubcommand((builder) =>
			builder.setName('hpq').setDescription('Henesys Party Quest')
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
		)
		.addSubcommand((builder) =>
			builder.setName('zpq').setDescription('Zakum prequest')
		)
		.addSubcommand((builder) =>
			builder.setName('hh').setDescription('Haunted Forest map')
		)
		.addSubcommand((builder) =>
			builder.setName('ninja_castle').setDescription('Ninja Castle map')
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case 'apqbonus':
			case 'apq':
			case 'hh':
			case 'hpq':
			case 'ninja_castle':
			case 'opq':
			case 'zpq': {
				const url = staticAssetNames[subcommand];
				if (url === undefined) {
					throw new Error(
						`Missing asset for subcommand: ${subcommand}`
					);
				}
				const embed = new EmbedBuilder().setImage(url);
				await interaction.reply({ embeds: [embed] });
				break;
			}
			case 'gpq': {
				const embed = new EmbedBuilder()
					.setTitle('Guild Party Quest')
					.setDescription(
						[
							'[Guide](https://mapleroyals.com/forum/threads/%E2%9C%AF-hollywood-presents-a-comprehensive-guide-to-guild-party-quest-gpq.27299/)',
							'Stage 2 code: 2152212',
							'[Stage 3 solver](https://maplegpq.com/)',
						].join('\n')
					);
				await interaction.reply({ embeds: [embed] });
				break;
			}
			case 'lpq': {
				const embed = new EmbedBuilder()
					.setTitle('Ludibrium Party Quest')
					.setDescription(
						'[Guide](https://mapleroyals.com/forum/threads/ludibrium-party-quest-lpq-guide.108791/)'
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
