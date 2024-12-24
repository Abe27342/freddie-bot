import {
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { querySpreadsheet } from './apis/index.js';
import { assert } from '../utils/index.js';

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

interface Bank {
	readonly name: string;
	readonly sheetId: string;
	fetchBalances(characters: string[]): Promise<Iterable<BankEntry>>;
}

class ResetBank {
	public readonly name = 'ResetPB';
	constructor(public readonly sheetId: string) {}

	public async fetchBalances(
		characters: string[]
	): Promise<Iterable<BankEntry>> {
		type Row = [string, number, number, number];
		const data = await querySpreadsheet(this.sheetId, 'Bank!B3:E');
		const headers = data[0];
		assert(headers[0] === 'IGN', 'Unexpected IGN column');
		assert(
			headers[1].toLowerCase().includes('meso'),
			'Unexpected meso column'
		);
		assert(
			headers[3].toLowerCase().includes('coin'),
			'Unexpected coin column'
		);
		const charactersSet = new Set(
			characters.map((char) => char.toLowerCase())
		);
		const entries = Array.from(
			data.filter(
				(value, index) =>
					index > 0 &&
					value[0] &&
					charactersSet.has(value[0].toLowerCase())
			)
		).map(([character, mesos, _, coins]) => {
			assert(isNumber(mesos));
			assert(isNumber(coins));
			return { bankName: this.name, character, mesos, coins };
		});
		return entries;
	}
}

class YaoBank {
	public constructor(
		public readonly name: string,
		public readonly sheetId: string
	) {}

	public async fetchBalances(
		characters: string[]
	): Promise<Iterable<BankEntry>> {
		type Row = [string, number, number, number];
		const data = await querySpreadsheet(this.sheetId, 'Quick Balance!A1:C');
		const headers = data[0];
		assert(headers[0] === 'Runners', 'Unexpected character column');
		assert(
			headers[1].toLowerCase().includes('meso'),
			'Unexpected meso column'
		);
		assert(
			headers[2].toLowerCase().includes('coin'),
			'Unexpected coin column'
		);
		const charactersSet = new Set(
			characters.map((char) => char.toLowerCase())
		);
		const entries = Array.from(
			data.filter(
				(value, index) =>
					index > 0 &&
					value[0] &&
					charactersSet.has(value[0].toLowerCase())
			)
		).map(([character, mesos, coins]) => {
			assert(isNumber(mesos));
			assert(isNumber(coins));
			return { bankName: this.name, character, mesos, coins };
		});
		return entries;
	}
}

function renderBankMd(bank: Bank): string {
	return `[${bank.name}](https://docs.google.com/spreadsheets/d/${bank.sheetId})`;
}

function isNumber(val: any): val is number {
	return typeof val === 'number' && !Number.isNaN(val);
}

const banks: Bank[] = [
	new ResetBank('1vH4qcYRvrw39C_todmazgpI7HTn0Epr466s2ORyLC_w'),
	new YaoBank('Dratini', '1VFR1iya58_697hqY-xQAsOK_FptXD_ZH_0pJDWPbmGY'),
	new YaoBank('Nightz PB1', '1DIGctiXHyE9_xnz1mxvwo4K11Qj1i9jVWhT5g6lLcTQ'),
];

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
					...banks.map((bank) => `\t- ${renderBankMd(bank)}`),
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

		const bankApiResponses = await Promise.all(
			banks.map<
				Promise<
					| { type: 'success'; result: Iterable<BankEntry> }
					| { type: 'error'; bank: Bank }
				>
			>((bank) =>
				bank
					.fetchBalances(characters)
					.then((result) => ({ type: 'success', result } as const))
					.catch((err) => {
						console.log(err);
						return { type: 'error', bank } as const;
					})
			)
		);

		const entries: BankEntry[] = bankApiResponses.flatMap((apiRes) =>
			apiRes.type === 'success' ? Array.from(apiRes.result) : []
		);

		const failedToFetch: Bank[] = bankApiResponses
			.filter(({ type }) => type === 'error')
			.map((res) => (res as { type: 'error'; bank: Bank }).bank);

		const embeds = [];
		if (failedToFetch.length > 0) {
			embeds.push(
				new EmbedBuilder()
					.setTitle('⚠️ Warning')
					.setDescription(
						[
							'Failed to load data from the following banks:',
							'',
							failedToFetch.map(
								(bank) => `\t- ${renderBankMd(bank)}`
							),
							'',
							'If this is a persistent issue, please file an issue on GitHub.',
						].join('\n')
					)
			);
		}

		if (entries.length === 0) {
			await interaction.reply({
				content:
					'None of those characters were found in a supported bank! Try "/bankbalance help"?',
				embeds,
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

		embeds.push(
			new EmbedBuilder().addFields(
				{
					name: 'Bank',
					value: bankNames.join('\n'),
					inline: true,
				},
				{
					name: 'Mesos',
					value: entriesByBankName
						.map((entry) =>
							entry.mesos.toLocaleString(undefined, {
								maximumFractionDigits: 0,
							})
						)
						.join('\n'),
					inline: true,
				},
				{
					name: 'Coins',
					value: entriesByBankName
						.map((entry) =>
							entry.coins.toLocaleString(undefined, {
								maximumFractionDigits: 2,
							})
						)
						.join('\n'),
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
			)
		);

		await interaction.reply({
			embeds,
		});
	},
};
