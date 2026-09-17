import { Item, MAPLESTORY_BASE_API } from './maplestory.js';

export const MAPLELEGENDS_BASE_API = 'https://legends.ml';

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

// Helper for encoding/decoding URLs accepted by maplestory.io.
const itemsCodec = {
	encode(items: Item[]): string {
		const stringified = JSON.stringify(items);
		return encodeURI(stringified.substring(1, stringified.length - 1));
	},
	decode(encoded: string): Item[] {
		return JSON.parse(`[${decodeURI(encoded)}]`);
	},
};

const GMS_AVATAR_VERSIONS = ['251', '241'];
const AVATAR_RENDER_TIMEOUT_MS = 5000;

function usesGmsVersion(item: Item): boolean {
	return item.region === undefined || item.region === 'GMS';
}

function getVersionedItems(items: Item[], gmsVersion: string): Item[] {
	return items.map((item) =>
		usesGmsVersion(item) ? { ...item, version: gmsVersion } : item
	);
}

function getRenderUrl(
	items: Item[],
	passthroughUrl: string,
	pathEnd: number,
	feetCenter: boolean
): URL {
	const updatedUrl = new URL(
		`/api/character/${itemsCodec.encode(
			items
		)}${passthroughUrl.substring(pathEnd)}`,
		MAPLESTORY_BASE_API
	);
	updatedUrl.search = new URL(passthroughUrl).search;
	if (feetCenter) {
		updatedUrl.searchParams.set('renderMode', 'feetCenter');
	}
	return updatedUrl;
}

async function fetchAvatarRender(url: URL): Promise<ArrayBuffer | undefined> {
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(AVATAR_RENDER_TIMEOUT_MS),
		});
		return response.ok ? await response.arrayBuffer() : undefined;
	} catch {
		return undefined;
	}
}

export async function getCharacterAvatar(
	name: string,
	feetCenter = false
): Promise<{ items: Item[]; avatar?: ArrayBuffer } | undefined> {
	const avatarUrl = new URL('/api/getavatar', MAPLELEGENDS_BASE_API);
	avatarUrl.searchParams.append('name', name);
	let response: Response;
	try {
		response = await fetch(avatarUrl.href, {
			signal: AbortSignal.timeout(AVATAR_RENDER_TIMEOUT_MS),
		});
	} catch (error) {
		throw new Error(
			`Failed to connect to MapleLegends API: ${error.message}`
		);
	}

	// Check for server errors
	if (response.status >= 500) {
		throw new Error(
			`MapleLegends API returned server error: ${response.status}`
		);
	}

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

	const items = itemsCodec.decode(encodedData);
	if (items.some(usesGmsVersion) || feetCenter) {
		for (const [index, version] of GMS_AVATAR_VERSIONS.entries()) {
			const avatar = await fetchAvatarRender(
				getRenderUrl(
					getVersionedItems(items, version),
					passthroughUrl,
					end,
					feetCenter
				)
			);
			if (avatar) {
				return { items, avatar };
			}

			const nextVersion = GMS_AVATAR_VERSIONS[index + 1];
			if (nextVersion) {
				console.warn(
					`MapleStory.io avatar render using GMS v${version} failed; falling back to v${nextVersion}.`
				);
			} else {
				console.warn(
					`MapleStory.io avatar render using GMS v${version} failed; rendering stats without an avatar.`
				);
				return { items };
			}
		}
	}

	return {
		items,
		avatar: await response.arrayBuffer(),
	};
}

export async function getCharacterStats(
	name: string
): Promise<Stats | undefined> {
	const url = new URL(`/api/character`, MAPLELEGENDS_BASE_API);
	url.searchParams.append('name', name);
	let response: Response;
	try {
		response = await fetch(url.href);
	} catch (error) {
		throw new Error(
			`Failed to connect to MapleLegends API: ${error.message}`
		);
	}

	if (response.status === 404) {
		return undefined;
	}

	if (response.status >= 500) {
		throw new Error(
			`MapleLegends API returned server error: ${response.status}`
		);
	}

	if (!response.ok) {
		throw new Error(
			`MapleLegends API request failed with status: ${response.status}`
		);
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

interface ApiLevelEntry {
	level: number;
	date: string;
}

export async function getCharacterLevels(
	name: string
): Promise<LevelEntry[] | undefined> {
	const url = new URL(`/api/getlevels`, MAPLELEGENDS_BASE_API);
	url.searchParams.append('name', name);
	const response = await fetch(url.href);
	const levelEntries: ApiLevelEntry[] = await response.json();
	return levelEntries.map(({ level, date }) => ({
		level,
		date: new Date(`${date} UTC`),
	}));
}
