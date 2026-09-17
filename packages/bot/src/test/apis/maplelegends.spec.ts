import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCharacterAvatar } from '../../commands/apis/maplelegends.js';
import type { Item } from '../../commands/apis/maplestory.js';

const sourceItems: Item[] = [
	{ itemId: 1000, version: '240' },
	{ itemId: 2000, region: 'TMS', version: '209' },
];

function getPassthroughUrl(items = sourceItems): string {
	const encodedItems = encodeURI(JSON.stringify(items).slice(1, -1));
	return `https://maplestory.io/api/character/${encodedItems}/stand2?resize=1&renderMode=default`;
}

function response(
	body: BodyInit | null,
	options: ResponseInit,
	url?: string
): Response {
	const result = new Response(body, options);
	if (url) {
		Object.defineProperty(result, 'url', { value: url });
	}
	return result;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('getCharacterAvatar', () => {
	it('uses GMS v251 while preserving versions for other regions', async () => {
		const avatar = new Uint8Array([1, 2, 3]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				response(null, { status: 200 }, getPassthroughUrl())
			)
			.mockResolvedValueOnce(response(avatar, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const result = await getCharacterAvatar('TestCharacter', true);

		expect(new Uint8Array(result.avatar)).toEqual(avatar);
		const renderUrl = decodeURI(fetchMock.mock.calls[1][0].toString());
		expect(renderUrl).toContain('"itemId":1000,"version":"251"');
		expect(renderUrl).toContain(
			'"itemId":2000,"region":"TMS","version":"209"'
		);
		expect(renderUrl).toContain('renderMode=feetCenter');
	});

	it('falls back from GMS v251 to v241', async () => {
		const avatar = new Uint8Array([4, 5, 6]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				response(null, { status: 200 }, getPassthroughUrl())
			)
			.mockResolvedValueOnce(response(null, { status: 500 }))
			.mockResolvedValueOnce(response(avatar, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await getCharacterAvatar('TestCharacter', true);

		expect(new Uint8Array(result.avatar)).toEqual(avatar);
		expect(decodeURI(fetchMock.mock.calls[2][0].toString())).toContain(
			'"itemId":1000,"version":"241"'
		);
		expect(warn).toHaveBeenCalledWith(
			'MapleStory.io avatar render using GMS v251 failed; falling back to v241.'
		);
	});

	it('returns character data without an avatar when both renders fail', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				response(null, { status: 200 }, getPassthroughUrl())
			)
			.mockResolvedValueOnce(response(null, { status: 500 }))
			.mockResolvedValueOnce(response(null, { status: 500 }));
		vi.stubGlobal('fetch', fetchMock);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await getCharacterAvatar('TestCharacter', true);

		expect(result).toEqual({ items: sourceItems });
		expect(warn).toHaveBeenLastCalledWith(
			'MapleStory.io avatar render using GMS v241 failed; rendering stats without an avatar.'
		);
	});
});
