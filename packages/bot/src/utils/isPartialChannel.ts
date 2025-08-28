import { Channel, PartialDMChannel, PartialGroupDMChannel } from 'discord.js';

export function isNotPartialChannel<T extends Channel>(
	channel: T
): channel is Exclude<T, PartialGroupDMChannel | PartialDMChannel> {
	return !channel.partial;
}
