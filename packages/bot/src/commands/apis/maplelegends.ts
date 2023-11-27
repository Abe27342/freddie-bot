import { Item, MAPLESTORY_BASE_API } from './maplestory.js';

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
