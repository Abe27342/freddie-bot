import { Interaction } from 'discord.js';

export interface InteractionHandler {
	name: string;
	execute: (interaction: Interaction) => Promise<void>;
}
