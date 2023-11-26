import {
	APIEmbedField,
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { PLAYERS_ARG } from './shared-args.js';

const staticAssetNames: Record<number, string> = {
	3: 'https://i.imgur.com/8CyAecT.png',
	4: 'https://i.imgur.com/ucg3l0P.png',
	5: 'https://i.imgur.com/Nd6dAhv.png',
	6: 'https://i.imgur.com/wAy9gmo.png',
	7: 'https://i.imgur.com/htOHH87.png',
	8: 'https://i.imgur.com/vybIyrz.png',
	9: 'https://i.imgur.com/XrPUoe7.png',
	10: 'https://i.imgur.com/DnLvvwA.png',
};

const cwkBoxCount = 30;

function computeFields(players: number): APIEmbedField[] {
	const boxesPerPlayer = Math.floor(cwkBoxCount / players);
	const remainder = cwkBoxCount % players;
	const fields: APIEmbedField[] = [];
	if (remainder === 0) {
		fields.push({
			name: `${boxesPerPlayer} chests for:`,
			value: Array.from({ length: players }, (_, i) => `${i + 1}`).join(
				', '
			),
		});
	} else {
		fields.push({
			name: `${boxesPerPlayer + 1} chests for:`,
			value: Array.from({ length: remainder }, (_, i) => `${i + 1}`).join(
				', '
			),
			inline: true,
		});
		fields.push({
			name: `${boxesPerPlayer} chests for:`,
			value: Array.from(
				{ length: players - remainder },
				(_, i) => `${i + 1 + remainder}`
			).join(', '),
			inline: true,
		});
	}
	return fields;
}

export const cwkpq: Command = {
	data: new SlashCommandBuilder()
		.setName('cwkpq')
		.addNumberOption((builder) =>
			builder
				.setName(PLAYERS_ARG)
				.setDescription('Number of players looting boxes')
				.setMinValue(3)
				.setMaxValue(10)
				.setRequired(true)
		)
		.setDescription('Show infographic on how to split boxes for cwkpq.'),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const players = interaction.options.getNumber(PLAYERS_ARG);
		const asset = staticAssetNames[players];
		if (!asset) {
			// TODO: This should be unnecessary validation thanks to `setMinValue`/`setMaxValue`.
			// Can probably be removed.
			await interaction.reply(
				'Invalid number of players. Must be between 3 and 10'
			);
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle(`CWKPQ Bonus Stage for a squad of ${players}`)
			.setFields(computeFields(players))
			.setImage(asset);
		await interaction.reply({ embeds: [embed] });
	},
};
