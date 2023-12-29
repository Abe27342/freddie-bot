import {
	AttachmentBuilder,
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import * as path from 'path';
import { promises as fs } from 'fs';
import { createCanvas, loadImage, Image } from 'canvas';
import { Command } from './types';
import {
	Stats,
	getCharacterAvatar,
	getCharacterStats,
	isUnbanned,
} from './apis/index.js';

const NAME_ARG = 'name';

let assetsEnsured = false;
export const maple: Command = {
	data: new SlashCommandBuilder()
		.setName('maple')
		.addStringOption((builder) =>
			builder
				.setName(NAME_ARG)
				.setDescription('Character name')
				.setMinLength(4)
				.setMaxLength(12)
				.setRequired(true)
		)
		.setDescription('Fetches a snapshot of the provided character'),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		await interaction.deferReply();
		const name = interaction.options.getString(NAME_ARG);

		const [stats, avatarInfo] = await Promise.all([
			getCharacterStats(name),
			getCharacterAvatar(name, true),
		]);
		if (!stats || !avatarInfo) {
			await interaction.editReply({
				content: 'Character not found.',
			});
			return;
		}

		const dir = './assets';
		const buffer = await renderCharacter(
			Buffer.from(avatarInfo.avatar),
			stats,
			name
		);

		const filename = `${name}-${Date.now()}.png`;
		if (!assetsEnsured) {
			await fs.mkdir(dir, { recursive: true });
			assetsEnsured = true;
		}
		const fullFilename = path.join(dir, filename);
		await fs.writeFile(fullFilename, buffer);

		const file = new AttachmentBuilder(fullFilename);
		await interaction.editReply({
			files: [file],
		});
		await fs.rm(fullFilename);
	},
};

const assets = [
	{
		name: 'caveoflife.png',
		x: 900,
		y: 104,
	},
];

async function renderCharacter(
	avatarBuffer: Buffer,
	stats: Stats,
	fallbackName: string
): Promise<Buffer> {
	const canvas = createCanvas(600, 400);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#0000ff';
	const asset = assets[0];
	const background = await loadImage(path.join('./assets', asset.name));
	ctx.drawImage(
		background,
		asset.x,
		asset.y,
		canvas.width / 2,
		canvas.height / 2,
		0,
		0,
		canvas.width,
		canvas.height
	);

	const avatar = new Image();
	avatar.src = avatarBuffer;
	ctx.drawImage(
		avatar,
		500 - avatar.naturalWidth * 2,
		// The avatar is foot-centered, hence not doubling the height here
		350 - avatar.naturalHeight,
		avatar.naturalWidth * 2,
		avatar.naturalHeight * 2
	);
	ctx.fillStyle = '#000000';
	ctx.globalAlpha = 0.8;
	ctx.roundRect(10, 10, 210, 290, 15);
	ctx.fill();

	// Include the stats
	ctx.fillStyle = '#ffffff';
	ctx.globalAlpha = 1;
	ctx.font = '26px Arial Greek';
	const baseline = 16;
	ctx.fillStyle = 'gold';
	ctx.fillText(!stats.name ? fallbackName : stats.name, 20, baseline + 40);

	if (isUnbanned(stats)) {
		ctx.fillStyle = '#ffffff';
		ctx.fillText(`Level: ${stats.level}`, 20, baseline + 70);
		ctx.fillText(
			`Exp: ${!stats.exp ? '0.00%' : stats.exp}`,
			20,
			baseline + 100
		);
		ctx.fillText(`Fame: ${stats.fame}`, 20, baseline + 130);
		ctx.fillText(`Cards: ${stats.cards}`, 20, baseline + 160);
		ctx.fillText(`Quests: ${stats.quests}`, 20, baseline + 190);
		ctx.fillText(`Job: ${stats.job}`, 20, baseline + 220);
		ctx.fillText(
			`Guild: ${!stats.guild ? 'N/A' : stats.guild}`,
			20,
			baseline + 250
		);
	}
	const buffer = canvas.toBuffer('image/png');
	return buffer;
}
