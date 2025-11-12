/**
 * Parses a time delta string in the format: 5d 3h 2m 30s
 * @param arg - The time delta string to parse
 * @returns The time delta in milliseconds, or undefined if the string is invalid
 * @example
 * parseTimeDelta("5d 3h 2m 30s") // Returns milliseconds for 5 days, 3 hours, 2 minutes, 30 seconds
 * parseTimeDelta("1h 30m") // Returns milliseconds for 1 hour, 30 minutes
 */
export function parseTimeDelta(arg: string): number | undefined {
	const matches = arg.match(
		/((?<days>\d+)d)?\s*((?<hours>\d+)h)?\s*((?<minutes>\d+)m)?\s*((?<seconds>\d+)s)?/
	);
	if (!matches) {
		return undefined;
	}
	const { days, hours, minutes, seconds } = matches.groups ?? {};
	return (
		1000 *
		(Number(days ?? 0) * 24 * 60 * 60 +
			Number(hours ?? 0) * 60 * 60 +
			Number(minutes ?? 0) * 60 +
			Number(seconds ?? 0))
	);
}
