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
import { Random, MersenneTwister19937 } from 'random-js';

const CHARACTERS_ARG = 'characters';

const PREVIOUS_ROLL_ARG = 'previous_roll';
const ADDED_CHARACTERS_ARG = 'add_characters';
const REMOVED_CHARACTERS_ARG = 'remove_characters';

const random = new Random(MersenneTwister19937.autoSeed());

/**
 * Performs an 'inside-out' [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle),
 * which has the advantage of not requiring knowledge of initial number of elements of the array.
 * This makes it adaptable to "rolling in" missed out party members while generally not disrupting the original roll.
 * @param arr Array to shuffle
 * @param startingAt If provided, elements of the array before this index will not participate in the shuffle.
 * @returns The shuffled array
 */
function shuffle<T>(arr: T[], startingAt = 0): T[] {
	const result: T[] = [];
	for (let i = 0; i < startingAt; i++) {
		result.push(arr[i]);
	}

	for (let i = startingAt; i < arr.length; i++) {
		const j = random.integer(0, result.length);
		if (j === result.length) {
			result.push(arr[i]);
		} else {
			if (startingAt !== 0 && arr.length - startingAt < 20) {
				// If only rolling in a small number of additional players, we use the naive O(n^2)
				// variant which avoids changing the underlying order of the original roll at all
				// while still being fair.
				for (let k = i; k > j; k--) {
					result[k] = result[k - 1];
				}
				result[j] = arr[i];
			} else {
				result.push(result[j]);
				result[j] = arr[i];
			}
		}
	}
	return result;
}

function parseCharacters(arg: string): string[] {
	return arg.split(/\s/).filter((name) => name.length > 0);
}

export const partyroll: Command = {
	data: new SlashCommandBuilder()
		.setName('partyroll')
		.setDescription('Fairly order a list of characters')
		.addSubcommand((builder) =>
			builder
				.setName('create')
				.addStringOption((builder) =>
					builder
						.setName(CHARACTERS_ARG)
						.setDescription(
							'Whitespace-separated list of names to partyroll'
						)
						.setRequired(true)
				)
				.setDescription(
					'Generate a new random ordering of a list of characters.'
				)
		)
		.addSubcommand((builder) =>
			builder
				.setName('redo')
				.addStringOption((builder) =>
					builder
						.setName(PREVIOUS_ROLL_ARG)
						.setDescription(
							'Copy + paste the contents of the previous roll'
						)
						.setRequired(true)
				)
				.addStringOption((builder) =>
					builder
						.setName(ADDED_CHARACTERS_ARG)
						.setDescription('Characters to add to the roll')
						.setRequired(false)
				)
				.addStringOption((builder) =>
					builder
						.setName(REMOVED_CHARACTERS_ARG)
						.setDescription('Characters to remove from the roll')
						.setRequired(false)
				)
				.setDescription(
					'Add or remove characters from a roll with minimal disruption to the original roll.'
				)
		),
	async execute(interaction: ChatInputCommandInteraction<CacheType>) {
		let results: string[];
		switch (interaction.options.getSubcommand()) {
			case 'redo': {
				const previousRoll = parseCharacters(
					interaction.options.getString(PREVIOUS_ROLL_ARG) ?? ''
				);
				const addedCharacters = parseCharacters(
					interaction.options.getString(ADDED_CHARACTERS_ARG) ?? ''
				);
				const removedCharacters = new Set(
					parseCharacters(
						interaction.options.getString(REMOVED_CHARACTERS_ARG) ??
							''
					)
				);

				const previouslyRolled = previousRoll.filter(
					(name) => !removedCharacters.has(name)
				);

				const newCharacters = [...previouslyRolled, ...addedCharacters];

				results = shuffle(newCharacters, previouslyRolled.length);
				break;
			}
			case 'create':
				{
					const characters = parseCharacters(
						interaction.options.getString(CHARACTERS_ARG)
					);
					results = shuffle(characters);
				}
				break;
			default:
				throw new Error(
					`Unknown subcommand ${interaction.options.getSubcommand()}`
				);
		}

		await interaction.reply(
			results.map((name, index) => `${index + 1}. ${name}`).join('\n')
		);
	},
};
