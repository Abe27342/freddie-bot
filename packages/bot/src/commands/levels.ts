import {
	AttachmentBuilder,
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Chart, registerables, _adapters } from 'chart.js';
import { StdDateAdapter } from 'chartjs-adapter-date-std';
import { createCanvas } from 'canvas';
import { Command } from './types';
import { getCharacterLevels } from './apis/index.js';

// See https://github.com/sgratzl/chartjs-chart-wordcloud/issues/4
// TODO: Not all of these registrations are needed. Could pare down to only what's necessary here.
Chart.register(...registerables);
_adapters._date.override(StdDateAdapter.chartJsStandardAdapter());

const NAME_ARG = 'names';
const SHOW_LINE_ARG = 'show_line';

export const levels: Command = {
	data: new SlashCommandBuilder()
		.setName('levels')
		.addStringOption((builder) =>
			builder
				.setName(NAME_ARG)
				.setDescription(
					'Space-separated list of character names. Maximum 5.'
				)
				.setRequired(true)
		)
		.addBooleanOption((builder) =>
			builder
				.setName(SHOW_LINE_ARG)
				.setDescription('Show lines between points')
				.setRequired(false)
		)
		.setDescription(
			"Displays a graph of the provided characters' levels over time."
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const names = interaction.options.getString(NAME_ARG).split(' ');
		if (names.length > 5) {
			await interaction.reply({
				ephemeral: true,
				content: 'Only 5 characters are supported at a time.',
			});
			return;
		}
		const showLine = interaction.options.getBoolean(SHOW_LINE_ARG) ?? false;

		await interaction.deferReply();

		const levels = await Promise.all(names.map(getCharacterLevels));
		if (levels.some((level) => !level)) {
			const missingCharacters = names.filter(
				(_, index) => !levels[index]
			);
			await interaction.editReply({
				content:
					missingCharacters.length === 1
						? `Character ${missingCharacters[0]} not found.`
						: `Characters ${missingCharacters.join(
								', '
						  )} not found.`,
			});
			return;
		}

		const canvas = createCanvas(1280, 720);
		const ctx = canvas.getContext('2d');

		let chart: Chart<any> | undefined;
		try {
			chart = new Chart(ctx as any, {
				type: 'line',
				data: {
					datasets: levels.map((levelEntries, index) => ({
						label: names[index],
						data: levelEntries.map(({ level, date }) => ({
							x: date,
							y: level,
						})),
						showLine,
					})),
				},
				options: {
					plugins: {
						title: {
							text: `Level history of ${names.join(', ')}`,
							display: true,
						},
					},
					scales: {
						x: {
							type: 'time',
							time: {
								// Luxon format string
								tooltipFormat: 'DD T',
							},
							title: {
								display: true,
								text: 'Date',
							},
						},
						y: {
							title: {
								display: true,
								text: 'Level',
							},
						},
					},
				},
				plugins: [
					{
						id: 'customCanvasBackground',
						beforeDraw: (chart, args, options) => {
							const { ctx } = chart;
							ctx.save();
							ctx.globalCompositeOperation = 'destination-over';
							ctx.fillStyle = '#36393e';
							ctx.fillRect(0, 0, canvas.width, canvas.height);
							ctx.restore();
						},
					},
				],
			});


			const file = new AttachmentBuilder(canvas.toBuffer('image/png'), {
				name: 'levels.png',
			});
			await interaction.editReply({
				files: [file],
			});
		} finally {
			chart.destroy();
		}
	},
};
