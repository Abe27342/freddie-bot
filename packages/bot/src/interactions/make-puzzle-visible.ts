// import { NodeId } from '@fluid-experimental/tree';
// import { SelectMenuInteraction } from 'discord.js';
// import { PuzzlehuntContext } from '../puzzlehunt-context.js';
// import { InteractionHandler } from './types';

// export const makePuzzleVisible: InteractionHandler = {
// 	name: 'makePuzzleVisible',
// 	async execute(
// 		{ puzzlehunt }: PuzzlehuntContext,
// 		interaction: SelectMenuInteraction
// 	) {
// 		if (!interaction.deferred) {
// 			await interaction.deferReply({ ephemeral: true });
// 		}

// 		const member = await interaction.guild.members.fetch(
// 			interaction.user.id
// 		);

// 		const puzzleIds = interaction.values.map(
// 			(strPuzzleId) => Number.parseInt(strPuzzleId) as NodeId
// 		);

// 		const roles = puzzleIds.map((puzzleId) => {
// 			const puzzle = puzzlehunt.getPuzzle(puzzleId);
// 			return interaction.guild.roles.cache.get(puzzle.discordInfo.roleId);
// 		});

// 		await member.roles.add(roles);
// 		await interaction.message.edit('');
// 		await interaction.editReply(
// 			`Subscribed to ${interaction.values.length} channel${
// 				interaction.values.length !== 1 ? 's' : ''
// 			}.`
// 		);
// 	},
// };
