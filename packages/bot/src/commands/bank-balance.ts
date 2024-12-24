import {
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';

const CHARACTERS_ARG = 'characters';

function parseCharacters(arg: string): string[] {
	return arg.split(/\s/).filter((name) => name.length > 0);
}

interface BankEntry {
	bankName: string;
	character: string;
	mesos: number;
	coins: number;
}

export const bankbalance: Command = {
	data: new SlashCommandBuilder()
		.setName('bankbalance')
		.setDescription('Integration with common ML banking systems')
		.addSubcommand((builder) =>
			builder
				.setName('get')
				.addStringOption((builder) =>
					builder
						.setName(CHARACTERS_ARG)
						.setDescription(
							'Whitespace-separated list of names to query for bank balances'
						)
						.setRequired(true)
				)
				.setDescription(
					'Get a bank balance summary for a list of characters.'
				)
		)
		.addSubcommand((builder) =>
			builder
				.setName('help')
				.setDescription(
					'Display information about supported banking systems.'
				)
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		if (interaction.options.getSubcommand() === 'help') {
			await interaction.reply({
				content: [
					'This command displays information about all recorded balances for a list of characters.',
					'The following banking systems are supported:',
					'\t- Pasta banks',
				].join('\n'),
				ephemeral: true,
			});
			return;
		}

		//
		const characters = parseCharacters(
			interaction.options.getString(CHARACTERS_ARG)
		);
		if (characters.length > 5) {
			await interaction.reply({
				content: 'Only up to 5 characters are supported.',
				ephemeral: true,
			});
			return;
		}

		// Replace this with real logic

		const entries: BankEntry[] = [
			{ bankName: 'foo', mesos: 0, coins: 1, character: 'bar' },
			{ bankName: 'baz', mesos: 500, coins: 3, character: 'baz' },
			{ bankName: 'baz', mesos: 300, coins: 2, character: 'foo2' },
		];

		if (entries.length === 0) {
			await interaction.reply({
				content:
					'None of those characters were found in a supported bank! Try "/bankbalance help"?',
				ephemeral: true,
			});
		}

		type AggregatedBankEntries = Map<
			string,
			{ mesos: number; coins: number; characters: string[] }
		>;
		const aggregatedEntries: AggregatedBankEntries = new Map();
		for (const { bankName, mesos, coins, character } of entries) {
			const current = aggregatedEntries.get(bankName) ?? {
				mesos: 0,
				coins: 0,
				characters: [],
			};
			current.mesos += mesos;
			current.coins += coins;
			current.characters.push(character);
			aggregatedEntries.set(bankName, current);
		}

		// Note: relying on stable JS map iteration order here
		const bankNames = Array.from(aggregatedEntries.keys());
		const entriesByBankName = Array.from(aggregatedEntries.values());

		const embed = new EmbedBuilder().addFields(
			{
				name: 'Bank',
				value: bankNames.join('\n'),
				inline: true,
			},
			{
				name: 'Mesos',
				value: entriesByBankName.map((entry) => entry.mesos).join('\n'),
				inline: true,
			},
			{
				name: 'Coins',
				value: entriesByBankName.map((entry) => entry.coins).join('\n'),
				inline: true,
			}
			// 4th embed never gets inlined, even if the space is available.
			// TODO: Could consider using a table system, or an alternate rendering style.
			// {
			// 	name: 'Characters',
			// 	value: entriesByBankName
			// 		.map((entry) => entry.characters)
			// 		.join('\n'),
			// 	inline: true,
			// }
		);

		await interaction.reply({
			embeds: [embed],
		});
	},
};
