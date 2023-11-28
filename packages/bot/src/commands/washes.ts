import {
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';

const LEVEL_ARG = 'level';
const JOB_ARG = 'job';
const MP_ARG = 'mp';

const jobs = [
	'spearman',
	'fighter',
	'page',
	'archer',
	'thief',
	'brawler',
	'gunslinger',
	'magician',
] as const;

function computeMinMp(job: string, level: number): number {
	switch (job) {
		case 'page':
		case 'spearman':
			return 4 * level + 155;
		case 'fighter':
			return 4 * level + 55;
		case 'archer':
			return 14 * level + 135;
		case 'thief':
			return 14 * level + 135;
		case 'brawler':
			return 18 * level + 95;
		case 'gunslinger':
			return 18 * level + 95;
		case 'magician':
			return 22 * level + 449;
		default:
			throw new Error(`Invalid job: ${job}`);
	}
}

function mpLossFromReset(job: string): number {
	switch (job) {
		case 'page':
		case 'spearman':
		case 'fighter':
			return 4;
		case 'archer':
		case 'thief':
			return 12;
		case 'brawler':
		case 'gunslinger':
			return 16;
		case 'magician':
			return 30;
		default:
			throw new Error(`Invalid job: ${job}`);
	}
}

function hpGainFromStaleWash(job: string): number {
	switch (job) {
		case 'page':
		case 'spearman':
		case 'fighter':
			return 20;
		case 'archer':
		case 'thief':
			return 16;
		case 'brawler':
		case 'gunslinger':
			return 18;
		case 'magician':
			return 6;
		default:
			throw new Error(`Invalid job: ${job}`);
	}
}

function hpGainFromFreshWash(job: string): number {
	switch (job) {
		case 'page':
		case 'spearman':
		case 'fighter':
			return 52;
		case 'archer':
		case 'thief':
			return 18;
		case 'brawler':
			return 38;
		case 'gunslinger':
			return 18;
		case 'magician':
			return 8;
		default:
			throw new Error(`Invalid job: ${job}`);
	}
}

export const washes: Command = {
	data: new SlashCommandBuilder()
		.setName('washes')
		.addStringOption((builder) =>
			builder
				.setName(JOB_ARG)
				.setDescription(
					'Character job (later jobs use the same formula, e.g. "buccaneer" should select "brawler").'
				)
				.setRequired(true)
				.setChoices(...jobs.map((job) => ({ name: job, value: job })))
		)
		.addNumberOption((builder) =>
			builder
				.setName(LEVEL_ARG)
				.setDescription('Character level')
				.setMinValue(1)
				.setMaxValue(200)
				.setRequired(true)
		)
		.addNumberOption((builder) =>
			builder
				.setName(MP_ARG)
				.setDescription('Current MP')
				.setRequired(true)
		)
		.setDescription(
			'Calculates how many washes a character can use based on their mp pool. Also provides cost info.'
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const job = interaction.options.getString(JOB_ARG);
		const level = interaction.options.getNumber(LEVEL_ARG);
		const mp = interaction.options.getNumber(MP_ARG);

		const excessMp = Math.max(mp - computeMinMp(job, level), 0);
		const washes = Math.floor(excessMp / mpLossFromReset(job));

		const aprCost = 3100 * washes;
		const votingDays = Math.ceil(aprCost / 5000);

		const disclaimer = ['fighter', 'spearman', 'page', 'brawler'].includes(
			job
		)
			? ' (assuming maxed HP bonus skills)'
			: '';
		await interaction.reply(
			`Your extra MP is ${excessMp.toLocaleString()}.\nYou can stale wash ${washes} time${
				washes === 1 ? '' : 's'
			} and gain ${
				washes * hpGainFromStaleWash(job)
			} HP.\nIf you use fresh washes instead, your expected HP gain${disclaimer} is ${
				washes * hpGainFromFreshWash(job)
			} (minimum: ${washes * (hpGainFromFreshWash(job) - 2)}, maximum: ${
				washes * (hpGainFromFreshWash(job) + 2)
			}).\nThe cost of AP resets is: ${aprCost.toLocaleString()} NX (${votingDays} day${
				votingDays === 1 ? '' : 's'
			} of voting).`
		);
	},
};
