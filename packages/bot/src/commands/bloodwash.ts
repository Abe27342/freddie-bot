import {
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';

const LEVEL_ARG = 'level';
const STR_ARG = 'str';
const DEX_ARG = 'dex';
const INT_ARG = 'int';
const LUK_ARG = 'luk';

export const bloodwash: Command = {
	data: new SlashCommandBuilder()
		.setName('bloodwash')
		.addNumberOption((builder) =>
			builder
				.setName(LEVEL_ARG)
				.setDescription('Character level')
				.setRequired(true)
		)
		.addNumberOption((builder) =>
			builder.setName(STR_ARG).setRequired(true).setDescription('STR')
		)
		.addNumberOption((builder) =>
			builder.setName(DEX_ARG).setRequired(true).setDescription('DEX')
		)
		.addNumberOption((builder) =>
			builder.setName(INT_ARG).setRequired(true).setDescription('INT')
		)
		.addNumberOption((builder) =>
			builder.setName(LUK_ARG).setRequired(true).setDescription('LUK')
		)
		.setDescription(
			'Calculates how many assigned AP you have on HP/MP. Assumes characters have job advanced if possible.'
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const level = interaction.options.getNumber(LEVEL_ARG);
		const str = interaction.options.getNumber(STR_ARG);
		const dex = interaction.options.getNumber(DEX_ARG);
		const int = interaction.options.getNumber(INT_ARG);
		const luk = interaction.options.getNumber(LUK_ARG);

		if (
			[level, str, dex, int, luk].some(
				(value) => typeof value !== 'number'
			)
		) {
			await interaction.reply({
				content: 'Usage: /bloodwash <level> <str> <dex> <int> <luk>.',
				ephemeral: true,
			});
			return;
		}

		let availableAp = 25 + 5 * (level - 1);
		if (level >= 70) {
			availableAp += 5;
		}
		if (level >= 120) {
			availableAp += 5;
		}

		const allocatedAp = str + dex + int + luk;

		await interaction.reply(
			`You have ${availableAp - allocatedAp} AP assigned on HP/MP.`
		);
	},
};
