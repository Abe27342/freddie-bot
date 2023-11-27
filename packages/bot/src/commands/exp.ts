import {
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { getCharacterStats, isUnbanned } from './apis/index.js';

const NAME_ARG = 'name';
const LEVEL_ARG = 'level';
const PERCENT_ARG = 'percent';
const START_ARG = 'start';
const START_PERCENT_ARG = 'start_percent';
const END_ARG = 'end';
const END_PERCENT_ARG = 'end_percent';

function parsePercentOrNumber(percent: string | undefined | null): number {
	// Note this includes 0 as falsy as well, but parsing '0' as 0 is correct anyway.
	if (!percent) {
		return 0;
	}
	let match = percent.match(/^(\d+(?:\.\d+)?)%$/);
	if (match !== null) {
		const result = parseFloat(match[1]);
		if (result >= 0 && result <= 100) {
			return result / 100;
		}
		throw new Error('Expected a percentage between 0 and 100%.');
	}
	// Accept numbers between 0 and 1.
	const result = parseFloat(percent);
	if (result >= 0 && result <= 1) {
		return result;
	}

	throw new Error(
		'Expected a number between 0 and 1 or a percentage between 0 and 100%.'
	);
}

// expTable[i] is the required exp to reach level i + 1 from level i.
const expTable = [
	0, 15, 34, 57, 92, 135, 372, 560, 840, 1242, 1716, 2360, 3216, 4200, 5460,
	7050, 8840, 11040, 13716, 16680, 20216, 24402, 28980, 34320, 40512, 47216,
	54900, 63666, 73080, 83720, 95700, 108480, 122760, 138666, 155540, 174216,
	194832, 216600, 240500, 266682, 294216, 324240, 356916, 391160, 428280,
	468450, 510420, 555680, 604416, 655200, 709716, 748608, 789631, 832902,
	878545, 926689, 977471, 1031036, 1087536, 1147132, 1209994, 1276301,
	1346242, 1420016, 1497832, 1579913, 1666492, 1757815, 1854143, 1955750,
	2062925, 2175973, 2295216, 2420993, 2553663, 2693603, 2841212, 2996910,
	3161140, 3334370, 3517093, 3709829, 3913127, 4127566, 4353756, 4592341,
	4844001, 5109452, 5389449, 5684790, 5996316, 6324914, 6671519, 7037118,
	7422752, 7829518, 8258575, 8711144, 9188514, 9692044, 10223168, 10783397,
	11374327, 11997640, 12655110, 13348610, 14080113, 14851703, 15665576,
	16524049, 17429566, 18384706, 19392187, 20454878, 21575805, 22758159,
	24005306, 25320796, 26708375, 28171993, 29715818, 31344244, 33061908,
	34873700, 36784778, 38800583, 40926854, 43169645, 45535341, 48030677,
	50662758, 53439077, 56367538, 59456479, 62714694, 66151459, 69776558,
	73600313, 77633610, 81887931, 86375389, 91108760, 96101520, 101367883,
	106922842, 112782213, 118962678, 125481832, 132358236, 139611467, 147262175,
	155332142, 163844343, 172823012, 182293713, 192283408, 202820538, 213935103,
	225658746, 238024845, 251068606, 264827165, 279339693, 294647508, 310794191,
	327825712, 345790561, 364739883, 384727628, 405810702, 428049128, 451506220,
	476248760, 502347192, 529875818, 558913012, 589541445, 621848316, 655925603,
	691870326, 729784819, 769777027, 811960808, 856456260, 903390063, 952895838,
	1005114529, 1060194805, 1118293480, 1179575962, 1244216724, 1312399800,
	1384319309, 1460180007, 1540197871, 1624600714, 1713628833, 1807535693,
	1906588648, 2011069705,
];
// cumulativeExpTable[i] is the exp required to reach level i from level 0.
const cumulativeExpTable = [0];
let currentTotalExp = 0;
for (const exp of expTable) {
	currentTotalExp += exp;
	cumulativeExpTable.push(currentTotalExp);
}

function resolveCumulativeExp(level: number, percent: number): number {
	return cumulativeExpTable[level] + (expTable[level] ?? 0) * percent;
}

function getExp(
	startLevel: number,
	startPercent: number,
	endLevel: number,
	endPercent: number
): number {
	return (
		resolveCumulativeExp(endLevel, endPercent) -
		resolveCumulativeExp(startLevel, startPercent)
	);
}

export const exp: Command = {
	data: new SlashCommandBuilder()
		.setName('exp')
		.addSubcommand((builder) =>
			builder
				.setName('character')
				.setDescription(
					'Get the exp a character needs to reach a certain level.'
				)
				.addStringOption((builder) =>
					builder
						.setName(NAME_ARG)
						.setDescription('Character name')
						.setMinLength(4)
						.setMaxLength(12)
						.setRequired(true)
				)
				.addIntegerOption((builder) =>
					builder
						.setName(LEVEL_ARG)
						.setDescription('Target level')
						.setMinValue(1)
						.setMaxValue(200)
						.setRequired(true)
				)
				.addStringOption((builder) =>
					builder
						.setName(PERCENT_ARG)
						.setDescription(
							"Target percent (e.g. '50%', '7.5%'). Defaults to 0%."
						)
						.setRequired(false)
				)
		)
		.addSubcommand((builder) =>
			builder
				.setName('between')
				.setDescription('Get the exp between two levels.')
				.addIntegerOption((builder) =>
					builder
						.setName(START_ARG)
						.setDescription('Start level')
						.setMinValue(1)
						.setMaxValue(200)
						.setRequired(true)
				)
				.addIntegerOption((builder) =>
					builder
						.setName(END_ARG)
						.setDescription('End level')
						.setMinValue(1)
						.setMaxValue(200)
						.setRequired(true)
				)
				.addStringOption((builder) =>
					builder
						.setName(START_PERCENT_ARG)
						.setDescription(
							"Initial percent (e.g. '50%', '7.5%'). Defaults to 0%."
						)
						.setRequired(false)
				)
				.addStringOption((builder) =>
					builder
						.setName(END_PERCENT_ARG)
						.setDescription(
							"Target percent (e.g. '50%', '7.5%'). Defaults to 0%."
						)
						.setRequired(false)
				)
		)
		.setDescription('Get the exp required to reach a certain level.'),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const subcommand = interaction.options.getSubcommand();
		let startLevel: number;
		let startPercent: number;
		let endLevel: number;
		let endPercent: number;
		switch (subcommand) {
			case 'character': {
				try {
					endPercent = parsePercentOrNumber(
						interaction.options.getString(PERCENT_ARG)
					);
				} catch (error) {
					await interaction.reply({
						ephemeral: true,
						content:
							'Expected percent to be a percentage between 0% and 100% or a number between 0 and 1.',
					});
					return;
				}
				const stats = await getCharacterStats(
					interaction.options.getString(NAME_ARG) ?? ''
				);
				if (!stats || !isUnbanned(stats)) {
					await interaction.reply('Character not found.');
					return;
				}

				startLevel = stats.level;
				startPercent = stats.exp ? parseFloat(stats.exp) / 100 : 0;
				endLevel = interaction.options.getInteger(LEVEL_ARG);
				break;
			}
			case 'between': {
				startLevel = interaction.options.getInteger(START_ARG);
				endLevel = interaction.options.getInteger(END_ARG);
				try {
					startPercent = parsePercentOrNumber(
						interaction.options.getString(START_PERCENT_ARG)
					);
				} catch (error) {
					await interaction.reply({
						ephemeral: true,
						content:
							'Expected start_percent to be a percentage between 0% and 100% or a number between 0 and 1.',
					});
					return;
				}
				try {
					endPercent = parsePercentOrNumber(
						interaction.options.getString(END_PERCENT_ARG)
					);
				} catch (error) {
					await interaction.reply({
						ephemeral: true,
						content:
							'Expected end_percent to be a percentage between 0% and 100% or a number between 0 and 1.',
					});
					return;
				}
				break;
			}

			default:
				throw new Error(`Unknown subcommand: ${subcommand}`);
		}

		const requiredExp = Math.ceil(
			getExp(startLevel, startPercent, endLevel, endPercent)
		);

		if (requiredExp >= 0) {
			await interaction.reply(
				`Exp required: ${requiredExp.toLocaleString()}`
			);
		} else {
			await interaction.reply({
				ephemeral: true,
				content:
					'Start level/percentage must be lower than end level/percentage.',
			});
		}
	},
};
