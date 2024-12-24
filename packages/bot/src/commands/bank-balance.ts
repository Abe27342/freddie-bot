import {
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import {
	createSheetFromTemplate,
	querySpreadsheet,
	updateSheetValues,
} from './apis/index.js';
import { assert } from '../utils/index.js';

const CHARACTERS_ARG = 'characters';

// Maximum number of rows that the template supports.
// We could programatically generate more and copy the right formulas, but this is a pretty niche edge case.
const TEMPLATE_ROW_LIMIT = 20;

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

class MilkFarmBank {
	public constructor(
		public readonly name: string,
		public readonly sheetId: string
	) {}

	public async fetchBalances(
		characters: string[]
	): Promise<Iterable<BankEntry>> {
		const data = await querySpreadsheet(this.sheetId, 'Bank!B16:D');
		const headers = data[0];
		assert(headers[0] === 'Runner', 'Unexpected character column');
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

function sheetLink(id: string): string {
	return `https://docs.google.com/spreadsheets/d/${id}`;
}

function renderBankMd(bank: Bank): string {
	return `[${bank.name}](${sheetLink(bank.sheetId)})`;
}

function isNumber(val: any): val is number {
	return typeof val === 'number' && !Number.isNaN(val);
}

const banks: Bank[] = [
	new ResetBank('1vH4qcYRvrw39C_todmazgpI7HTn0Epr466s2ORyLC_w'),
	new YaoBank('Dratini', '1VFR1iya58_697hqY-xQAsOK_FptXD_ZH_0pJDWPbmGY'),
	new YaoBank('Pasta 1/3', '15Ms9iyuaBvFs96gmqV-eL5Dly0S-twTMZMl0ep45XGM'),
	new YaoBank('Pasta 2', '1DIGctiXHyE9_xnz1mxvwo4K11Qj1i9jVWhT5g6lLcTQ'),
	new MilkFarmBank(
		'Milkfarm',
		'1zO54HSjqBBe-2WrM22LzMcVK_pWOrQHRNXjZV22tMFc'
	),
	new YaoBank('Favela', '1Ad_1uYD5fIuqtGvtLcGmDOQGBfzlsNRsGRDcaL2Y3Zo'),
	new YaoBank('Gurk', '1-ZE8gzWwEYhlui6i3FMfrC0oKlxzhDQgcqTkXNucPAw'),
	new YaoBank('LCB', '1xpzGIYSeKL9nu7j4g85Fo9qMjmewKc3xR7SRiul39sk'),
	new YaoBank('Moo', '1AeihIxHgTN6pmfHgPm_UgMhdukwZaKQkrXVq2iHaxj4'),
	new YaoBank('Nightz', '1sX7vbMR6ldaeOsH3WfVVw9fNHE67IdzWG9_S8z5O3q0'),
	new YaoBank('Wicked', '150u-MJyEI-eXa8aL0YRumQlMBxMYI7U9YiNnmy6A-ZA'),
];

function rightAlign(lines: string[]): string[] {
	const maxLength = lines.reduce(
		(currentMax, line) => Math.max(currentMax, line.length),
		0
	);
	return lines.map(
		(line) => `\`${' '.repeat(maxLength - line.length)}${line}\``
	);
}

function mdLink(text: string, url: string): string {
	return `[${text}](${url})`;
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
				.setName('export')
				.addStringOption((builder) =>
					builder
						.setName(CHARACTERS_ARG)
						.setDescription(
							'Whitespace-separated list of names to query for bank balances'
						)
						.setRequired(true)
				)
				.setDescription(
					'Creates a google sheet containing a bank balance summary for a list of characters.'
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
					'',
					...banks.map((bank) => `- ${renderBankMd(bank)}`),
				].join('\n'),
				ephemeral: true,
			});
			return;
		}

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

		await interaction.deferReply();
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
							...failedToFetch.map(
								(bank) => `- ${renderBankMd(bank)}`
							),
							'',
							'If this is a persistent issue, please file an issue on GitHub.',
						].join('\n')
					)
			);
		}

		type AggregatedBankEntries = Map<
			string,
			{ mesos: number; coins: number; characters: string[] }
		>;
		const bankNameToBank = new Map(banks.map((bank) => [bank.name, bank]));
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

		const getBank = (bankName: string) => {
			const bank = bankNameToBank.get(bankName);
			assert(bank !== undefined, `Unknown bank: ${bankName}`);
			return bank;
		};

		if (entries.length === 0) {
			if (interaction.options.getSubcommand() === 'get') {
				await interaction.reply({
					content:
						'None of those characters were found in a supported bank! Try "/bankbalance help"?',
					embeds,
				});
				return;
			} else {
				await interaction.reply({
					content: `None of those characters were found in a supported bank. You can make a copy of the template ${mdLink(
						'here',
						''
					)} if you like..`,
				});
			}
		}

		if (interaction.options.getSubcommand() === 'get') {
			embeds.push(
				new EmbedBuilder().addFields(
					{
						name: 'Bank',
						value: bankNames
							.map((bankName) => renderBankMd(getBank(bankName)))
							.join('\n'),
						inline: true,
					},
					{
						name: 'Mesos',
						value: rightAlign(
							entriesByBankName.map((entry) =>
								entry.mesos.toLocaleString(undefined, {
									maximumFractionDigits: 0,
								})
							)
						).join('\n'),
						inline: true,
					},
					{
						name: 'Coins',
						value: rightAlign(
							entriesByBankName.map((entry) =>
								entry.coins.toLocaleString(undefined, {
									maximumFractionDigits: 2,
									minimumFractionDigits: 2,
								})
							)
						).join('\n'),
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
			await interaction.editReply({
				embeds,
			});
		} else {
			await interaction.editReply({
				embeds,
				content: 'Creating google sheet...',
			});

			const folderId = '1lQN7hnw2tHE5a2afeh3MM9N0LGweMhXz';
			const templateId = '179-BbVGXY4YUPBrt_WW1bHteXwwSoHAcAIrEsTKDujo';

			const sheetId = await createSheetFromTemplate({
				name: `Bank aggregator: ${characters.join(',')}`,
				templateId,
				folderId,
			});

			if (entries.length > TEMPLATE_ROW_LIMIT) {
				embeds.push(
					new EmbedBuilder()
						.setTitle('⚠️ Warning')
						.setDescription(
							[
								'Too many accounts to enter into the spreadsheet. The following bank/account combinations were not added:',
								'',
								...entries
									.slice(TEMPLATE_ROW_LIMIT)
									.map(
										(entry) =>
											`- ${renderBankMd(
												getBank(entry.bankName)
											)}: IGN ${entry.character}`
									),
								'',
								'You can add these accounts to the spreadsheet manually after inserting enough rows and copying formulas.',
							].join('\n')
						)
				);
				entries.splice(TEMPLATE_ROW_LIMIT);
			}

			await updateSheetValues({
				spreadsheetId: sheetId,
				requestBody: {
					data: [
						{
							range: 'Bank!A2:A',
							values: entries.map((entry) => [entry.bankName]),
						},
						{
							range: 'Bank!C2:C',
							values: entries.map((entry) => [
								sheetLink(getBank(entry.bankName).sheetId),
							]),
						},
						{
							range: 'Bank!D2:D',
							values: entries.map((entry) => {
								const bank = bankNameToBank.get(entry.bankName);
								if (bank instanceof YaoBank) {
									return ['God Banker Yao'];
								} else if (bank instanceof ResetBank) {
									return ['Reset'];
								} else if (bank instanceof MilkFarmBank) {
									return ['Milkfarm'];
								}

								return [];
							}),
						},
						{
							range: 'Bank!F2:F',
							values: entries.map((entry) => [entry.character]),
						},
					],
					valueInputOption: 'USER_ENTERED',
				},
			});

			await interaction.editReply({
				embeds,
				content: `Sheet created ${mdLink(
					'here',
					sheetLink(sheetId)
				)}. Please make a copy to your own drive via 'File' -> 'Make a copy'. This sheet will be deleted after some time.`,
			});
		}
	},
};
