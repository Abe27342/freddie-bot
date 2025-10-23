import {
	ActionRowBuilder,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	CacheType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types';
import { FreddieBotClient } from '../types';
import {
	RESPAWN_VARIANCE,
	ML_CHANNELS,
	bosses,
	bossNames,
	Boss,
	DiscordChannelScopedTimerAggregator,
	ChannelInstancer,
	HasTimerAggregators,
	timerSymbol,
	shortTime,
	longTime,
	isTimerExpired,
	createChannelInstancer,
	getTimerAggregatorForChannel,
	allChannels,
	buildBossTimerMessage,
} from './bosstimer-helper.js';
import { assert } from '../utils/index.js';

const NAME_ARG = 'name';
const CHANNEL_ARG = 'channel';
const DISCORD_CHOICE_API_LIMIT = 25;

export const bosstimer: Command = {
	data: new SlashCommandBuilder()
		.setName('bosstimer')
		.addSubcommand((builder) =>
			builder
				.setName('add')
				.setDescription('Add a timer for a boss.')
				.addStringOption((builder) =>
					builder
						.setName(NAME_ARG)
						.setDescription(
							'Name of the boss to set a timer for. Not all choices are shown. Type for autocomplete.'
						)
						.setAutocomplete(true)
						.setRequired(true)
				)
				.addStringOption((builder) =>
					builder
						.setName(CHANNEL_ARG)
						.setDescription(
							'Space-separated list of channels to add timers to. "all" is shorthand for all channels.'
						)
						.setRequired(true)
				)
		)
		.addSubcommand((builder) =>
			builder
				.setName('show')
				.setDescription('Show existing timers for a boss.')
				.addStringOption((builder) =>
					builder
						.setName(NAME_ARG)
						.setDescription('Name of the boss to show timers for.')
						.setAutocomplete(true)
						.setRequired(true)
				)
		)
		.addSubcommand((builder) =>
			builder
				.setName('delete')
				.setDescription('Delete an existing timer for a boss.')
				.addStringOption((builder) =>
					builder
						.setName(NAME_ARG)
						.setDescription(
							'Name of the boss to remove the timer for.'
						)
						.setAutocomplete(true)
						.setRequired(true)
				)
				.addStringOption((builder) =>
					builder
						.setName(CHANNEL_ARG)
						.setDescription(
							'Space-separated list of channels to remove timers from. "all" is shorthand for all channels.'
						)
						.setRequired(true)
				)
		)
		.setDescription(
			"Set, modify, or show reminder timers for boss's spawn."
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case 'add': {
				await addBossTimer(interaction);
				break;
			}
			case 'show': {
				await showBossTimersWithButtons(interaction);
				break;
			}
			case 'delete': {
				await deleteBossTimer(interaction);
				break;
			}
			default: {
				throw new Error(`Invalid subcommand: ${subcommand}`);
			}
		}
	},

	async autocomplete(
		interaction: AutocompleteInteraction<CacheType>
	): Promise<void> {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name === NAME_ARG) {
			const choices = bossNames.filter((choice) =>
				choice.startsWith(focusedOption.value.toLowerCase())
			);
			if (choices.length > DISCORD_CHOICE_API_LIMIT) {
				choices.splice(
					DISCORD_CHOICE_API_LIMIT,
					choices.length - DISCORD_CHOICE_API_LIMIT
				);
			}
			await interaction.respond(
				choices.map((choice) => ({ name: choice, value: choice }))
			);
		}
	},

	async initialize(client: FreddieBotClient): Promise<void> {
		const instancer =
			createChannelInstancer<DiscordChannelScopedTimerAggregator>();
		(client as HasTimerAggregators)[timerSymbol] = instancer;
		const existingTimers = await client.bosses.getExistingTimers();
		for (const {
			name,
			channelId,
			channel,
			expiration,
			reminderSent,
		} of existingTimers) {
			const timerAggregator = getTimerAggregatorForChannel(
				client,
				channelId
			);
			// Only add timers that haven't expired yet AND haven't had reminders sent
			// Expired timers will still be loaded for display purposes but won't trigger new notifications
			if (!reminderSent) {
				timerAggregator.addBossTimer(name, expiration, [channel]);
			}
		}
	},
};

function getTimerAggregatorInstancer(
	interaction: ChatInputCommandInteraction
): ChannelInstancer<DiscordChannelScopedTimerAggregator> {
	const instancer = (interaction.client as HasTimerAggregators)[timerSymbol];
	assert(instancer !== undefined);
	return instancer;
}

async function parseAndValidateChannel(
	interaction: ChatInputCommandInteraction
): Promise<number[] | undefined> {
	const arg = interaction.options.getString(CHANNEL_ARG);
	if (arg.toLowerCase() === 'all') {
		return Array.from(allChannels);
	}

	let channels: number[];
	try {
		channels = arg.split(' ').map((c) => parseInt(c, 10));
	} catch (error) {
		await interaction.reply({
			ephemeral: true,
			content:
				'Invalid channel argument. Please specify a space-separate list of numbers, or "all".',
		});
		return undefined;
	}

	if (channels.some((channel) => channel < 1 || channel > ML_CHANNELS)) {
		await interaction.reply({
			ephemeral: true,
			content: `Invalid channel argument. Channels must be between 1 and ${ML_CHANNELS}.`,
		});
		return undefined;
	}

	return channels;
}

async function parseAndValidateName(
	interaction: ChatInputCommandInteraction
): Promise<{ respawnCooldownMs: number; name: Boss } | undefined> {
	const name = interaction.options.getString(NAME_ARG);
	const respawnCooldownMs = bosses.get(name);
	if (respawnCooldownMs === undefined) {
		await interaction.reply({
			ephemeral: true,
			content: `This boss is not supported. Select one of: ${bossNames.join(
				', '
			)}.`,
		});
		return;
	}
	return { respawnCooldownMs, name };
}

async function addBossTimer(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const [channels, nameInfo] = await Promise.all([
		parseAndValidateChannel(interaction),
		parseAndValidateName(interaction),
	]);
	if (channels === undefined || nameInfo === undefined) {
		return;
	}

	const { name, respawnCooldownMs } = nameInfo;

	const client = interaction.client as FreddieBotClient;

	const respawnTimeMs =
		Date.now() + respawnCooldownMs * (1 - RESPAWN_VARIANCE);
	await Promise.all([
		interaction.deferReply(),
		client.bosses.addBossTimers(
			channels.map((channel) => ({
				name,
				channel,
				expiration: respawnTimeMs,
				channelId: interaction.channelId,
			}))
		),
	]);

	const { channelId } = interaction;
	const timerAggregator = getTimerAggregatorForChannel(client, channelId);

	timerAggregator.addBossTimer(name, respawnTimeMs, channels);

	if (channels.length > 1) {
		await interaction.editReply(
			`${name} timer added on channels: ${channels.join(', ')}.`
		);
	} else {
		await interaction.editReply(
			`${name} timer added on channel ${channels[0]}.`
		);
	}
}

async function showBossTimersWithButtons(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const { name, respawnCooldownMs } =
		(await parseAndValidateName(interaction)) ?? {};
	if (name === undefined || respawnCooldownMs === undefined) {
		return;
	}

	const client = interaction.client as FreddieBotClient;
	// Fetch all timers for this boss from the database to include expired ones
	const allTimers = await client.bosses.getExistingTimers();
	const timers = allTimers
		.filter((t) => t.name === name && t.channelId === interaction.channelId)
		.map((t) => ({
			channel: t.channel,
			expiration: t.expiration,
			reminderSent: t.reminderSent,
		}));

	const { content, components } = buildBossTimerMessage(
		name,
		timers,
		respawnCooldownMs
	);

	await interaction.reply({
		content,
		components,
	});
}

async function deleteBossTimer(
	interaction: ChatInputCommandInteraction<CacheType>
): Promise<void> {
	const [channels, nameInfo] = await Promise.all([
		parseAndValidateChannel(interaction),
		parseAndValidateName(interaction),
	]);
	if (channels === undefined || nameInfo === undefined) {
		return;
	}

	const { name } = nameInfo;

	const instancer = getTimerAggregatorInstancer(interaction);
	const timerAggregator = instancer.get(interaction.channelId);
	if (timerAggregator === undefined) {
		await interaction.reply('No timers were pending for this boss.');
		return;
	}

	const previousTimers = timerAggregator.getExistingTimers(name);
	const removedTimers = previousTimers
		.filter((timer) => channels.includes(timer.channel))
		.map((t) => t.channel);

	if (removedTimers.length === 0) {
		await interaction.reply('No timers were pending for this boss.');
		return;
	}
	timerAggregator.clearBossTimer(name, channels);

	if (timerAggregator.isEmpty) {
		instancer.delete(interaction.channelId);
	}

	const client = interaction.client as FreddieBotClient;
	await Promise.all([
		interaction.deferReply(),
		client.bosses.clearBossTimer(
			name,
			interaction.channelId,
			removedTimers
		),
	]);

	let msg = `${name} timer removed on ${
		removedTimers.length === 1
			? `channel ${removedTimers[0]}`
			: `channels: ${removedTimers.join(', ')}`
	}.`;

	if (removedTimers.length !== channels.length) {
		msg += ' No timer was set on remaining channels.';
	}
	await interaction.editReply(msg);
}
