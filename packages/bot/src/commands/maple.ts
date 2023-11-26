import {
	AttachmentBuilder,
	CacheType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js';
import * as path from 'path';
import { promises as fs } from 'fs';
import { Command } from './types';

const NAME_ARG = 'name';

const MAPLELEGENDS_BASE_API = 'https://maplelegends.com';
const MAPLESTORY_BASE_API = 'https://maplestory.io';

interface Item {
	itemId: number;
	version: string;
	region?: string;
}

interface ItemTypeInfo {
	overallCategory: string;
	category: string;
	subCategory: string;
	lowItemId: number;
	highItemId: number;
}

interface ItemMetadata {
	id: number;
	region: string; // 'GMS' | 'TMS'
	version: string;
	typeInfo: ItemTypeInfo;
}

interface ItemSet {
	[subCategory: string]: ItemMetadata; // subcategory should match the subcategory field of ItemTypeInfo inside the metadata.
}

interface MaplesimImportableJson {
	id: number;
	type: string; // 'character' | 'pet' | 'npc' etc?
	action: string;
	skin: number;
	zoom: number;
	frame: number;
	selectedItems: ItemSet;
	visible: boolean;
	position: { x: number; y: number };
	name: string;
	includeBackground: boolean;
}

type Stats = BannedStats | UnbannedStats;

type BannedStats = {
	name: undefined;
};

interface UnbannedStats {
	name: string;
	guild: string | undefined;
	level: number;
	gender: string;
	job: string;
	exp: string;
	quests: number;
	cards: number;
	donor: boolean;
	fame: number;
}

function isUnbanned(stats: Stats): stats is UnbannedStats {
	return stats.name !== undefined;
}

async function getCharacterAvatar(
	name: string
): Promise<{ items: Item[]; avatar: ArrayBuffer } | undefined> {
	const avatarUrl = new URL('/api/getavatar', MAPLELEGENDS_BASE_API);
	avatarUrl.searchParams.append('name', name);
	const response = await fetch(avatarUrl.href);
	const passthroughUrl = response.url;
	const prefix = `${MAPLESTORY_BASE_API}/api/character/`;
	if (!passthroughUrl.startsWith(prefix)) {
		if (response.ok) {
			throw new Error(`Unexpected passthrough URL: ${passthroughUrl}`);
		}
		return undefined;
	}
	const start = passthroughUrl.indexOf(prefix) + prefix.length;
	const end = passthroughUrl.lastIndexOf('/');
	const encodedData = passthroughUrl.substring(start, end);
	return {
		items: JSON.parse(`[${decodeURI(encodedData)}]`),
		avatar: await response.arrayBuffer(),
	};
}

async function getCharacterStats(name: string): Promise<Stats | undefined> {
	const url = new URL(`/api/character`, MAPLELEGENDS_BASE_API);
	url.searchParams.append('name', name);
	const response = await fetch(url.href);
	if (response.status === 404) {
		return undefined;
	}
	return await response.json();
}

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
			getCharacterAvatar(name),
		]);
		if (!stats || !avatarInfo) {
			await interaction.editReply({
				content: 'Character not found.',
			});
			return;
		}
		const dir = './assets';
		const filename = `${name}-${Date.now()}.png`;
		if (!assetsEnsured) {
			await fs.mkdir(dir, { recursive: true });
			assetsEnsured = true;
		}
		const fullFilename = path.join(dir, filename);
		await fs.writeFile(fullFilename, Buffer.from(avatarInfo.avatar));

		const file = new AttachmentBuilder(fullFilename);
		const embed = new EmbedBuilder()
			.setTitle(stats.name ?? name)
			.setImage(`attachment://${filename}`);
		if (isUnbanned(stats)) {
			embed.addFields(
				{ name: 'Level', value: `${stats.level}`, inline: true },
				{
					name: 'Exp',
					value: !stats.exp ? '0.00%' : stats.exp,
					inline: true,
				},
				{ name: 'Fame', value: `${stats.fame}`, inline: true },
				{ name: 'Cards', value: `${stats.cards}`, inline: true },
				{ name: 'Quests', value: `${stats.quests}`, inline: true },
				{ name: 'Job', value: stats.job, inline: true },
				{
					name: 'Guild',
					value: !stats.guild ? 'N/A' : stats.guild,
					inline: true,
				}
			);
		}

		await interaction.editReply({
			embeds: [embed],
			files: [file],
		});
		await fs.rm(fullFilename);
	},
};
