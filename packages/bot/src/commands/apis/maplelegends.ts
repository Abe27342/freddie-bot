import { assert } from '../../utils/index.js';
import { Item, MAPLESTORY_BASE_API } from './maplestory.js';
import { JSDOM } from 'jsdom';

export const MAPLELEGENDS_BASE_API = 'https://maplelegends.com';

export type Stats = BannedStats | UnbannedStats;

export type BannedStats = {
	name: undefined;
};

export interface UnbannedStats {
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

export function isUnbanned(stats: Stats): stats is UnbannedStats {
	return stats.name !== undefined;
}

export async function getCharacterAvatar(
	name: string,
	feetCenter = false
): Promise<{ items: Item[]; avatar: ArrayBuffer } | undefined> {
	const avatarUrl = new URL('/api/getavatar', MAPLELEGENDS_BASE_API);
	avatarUrl.searchParams.append('name', name);
	let response = await fetch(avatarUrl.href);
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
	if (feetCenter) {
		const newRequestUrl = new URL(passthroughUrl);
		newRequestUrl.searchParams.set('renderMode', 'feetCenter');
		response = await fetch(newRequestUrl.href);
		if (!response.ok) {
			throw new Error('Unable to get feet-centered avatar');
		}
	}
	return {
		items: JSON.parse(`[${decodeURI(encodedData)}]`),
		avatar: await response.arrayBuffer(),
	};
}

export async function getCharacterStats(
	name: string
): Promise<Stats | undefined> {
	const url = new URL(`/api/character`, MAPLELEGENDS_BASE_API);
	url.searchParams.append('name', name);
	const response = await fetch(url.href);
	if (response.status === 404) {
		return undefined;
	}
	return await response.json();
}

export async function getOnline(): Promise<number | undefined> {
	const url = new URL(`/api/get_online_users`, MAPLELEGENDS_BASE_API);
	const response = await fetch(url.href);
	if (!response.ok) {
		return undefined;
	}
	return (await response.json()).usercount;
}

export async function getUniqueUsers(): Promise<
	{ daily: number; weekly: number; monthly: number } | undefined
> {
	const url = new URL(`/api/get_unique_users`, MAPLELEGENDS_BASE_API);
	const response = await fetch(url.href);
	if (!response.ok) {
		return undefined;
	}
	return await response.json();
}

export interface LevelEntry {
	level: number;
	date: Date;
}

export async function getCharacterLevels(
	name: string
): Promise<LevelEntry[] | undefined> {
	// Unfortunately there isn't an API for this, so we need to scrape the data from the rankings page.
	const url = new URL(`/levels`, MAPLELEGENDS_BASE_API);
	url.searchParams.append('name', name);
	const response = await fetch(url.href);
	const dom = new JSDOM(await response.text());
	// This is obviously very brittle, but should return table rows for the levels table, including header.
	const levelsTable = dom.window.document.querySelectorAll(
		'#page-content > div:nth-child(2) > div > table > tbody > tr'
	);

	const levelEntries: { level: number; date: Date }[] = [];

	levelsTable.forEach((row, index) => {
		if (index === 0) {
			assert(
				!!row.children.item(0).textContent.match(/Level/) &&
					!!row.children.item(1).textContent.match(/Date/),
				'Expected to locate level/date table.'
			);
		} else {
			levelEntries.push({
				level: Number.parseInt(row.children.item(0).textContent, 10),
				date: new Date(`${row.children.item(1).textContent} UTC`),
			});
		}
	});

	levelEntries.reverse();
	return levelEntries;
}
