// Some starter code on https://github.com/discordjs/discord.js/discussions/6179
// There aren't many great examples of discord.js bots with tests.
// The approach here is generally to mock the server's response to the bot's requests by overriding
// the appropriate REST methods on the client, and expose that state for inspection upon test completion
// (e.g. to assert that appropriate discord objects have been created).
import { expect, vi } from 'vitest';
import {
	Client,
	Guild,
	Channel,
	User,
	GuildMember,
	Message,
	ChatInputCommandInteraction,
	InteractionType,
	ApplicationCommandType,
	RequestData,
	Routes,
	ClientUser,
	ChannelType,
	TextChannel,
	OverwriteType,
} from 'discord.js';

const FREDDIE_USER_ID = 'mock-bot-id';

export interface HasId {
	id: string;
}
export interface HasName {
	name: string;
}
export interface GuildData extends HasId, HasName {}

export interface PermissionOverwriteData {
	id: string;
	type: OverwriteType;
	allow: string; // conceptually a BitFlag/bigint
	deny: string; // conceptually a BitFlag/bigint
}

export interface ChannelData extends HasId, HasName {
	type: ChannelType;
	guild_id: string;
	parent_id?: string;
	permission_overwrites?: PermissionOverwriteData[];
}
export interface RoleData extends HasId, HasName {
	mentionable: boolean;
}

export interface UserData extends HasId {
	username: string;
}

export type EmbedData = any;

export interface MessageData extends HasId {
	content: string;
	embeds?: EmbedData[];
	channel_id: string;
	guild_id: string;
	author: UserData;
	pinned?: boolean;
	/**
	 * Sample data:
	 *
	 * id: BigInt(10),
	 * type: 'DEFAULT',
	 * content: content,
	 * author: this.user,
	 * webhook_id: null,
	 * member: this.guildMember,
	 * pinned: false,
	 * tts: false,
	 * nonce: 'nonce',
	 * embeds: [],
	 * attachments: [],
	 * edited_timestamp: null,
	 * reactions: [],
	 * mentions: [],
	 * mention_roles: [],
	 * mention_everyone: [],
	 * hit: false,
	 */
}
export interface IServerState {
	guilds: GuildData[];
	roles: RoleData[];
	channels: ChannelData[];
	messages: Map<string, MessageData[]>;

	findChannelBy(type: 'name' | 'id', value: string): ChannelData;
}

export class ServerState implements IServerState {
	public readonly guilds: GuildData[] = [];
	public readonly roles: RoleData[] = [];
	public readonly channels: ChannelData[] = [];
	public readonly messages: Map<string, MessageData[]> = new Map();

	findChannelBy(type: 'name' | 'id', value: string): ChannelData {
		expect(
			this.channels.map((channel) =>
				type === 'name' ? channel.name : channel.id
			)
		).toContain(value);
		const result = this.channels.find((channel) => channel[type] === value);
		return result;
	}
}

export interface Reaction {
	emoji?: string;
	user?: { id?: string };
}

// TODO: fix typing
export type MockCommand = any;

export interface MockDiscordOptions {
	message?: {
		content: string;
	};

	partyChannel?: {
		messages?: Message[];
	};

	reaction?: Reaction;
}

export class MockDiscord {
	private client!: Client;
	private guild!: Guild;
	private channel!: Channel;
	private user!: User;
	private guildMember!: GuildMember;
	public serverState: IServerState;

	constructor() {
		this.mockClient();
		this.mockGuild();

		this.mockUser();
		this.mockGuildMember();

		this.client.guilds.cache.set(this.guild.id, this.guild);
	}

	public getClient(): Client {
		return this.client;
	}

	public getGuild(): Guild {
		return this.guild;
	}

	public getChannel(): Channel {
		return this.channel;
	}

	public getUser(): User {
		return this.user;
	}

	public getGuildMember(): GuildMember {
		return this.guildMember;
	}

	public createCommandInteraction(
		command: MockCommand,
		interactionSource?: ChannelData
	): ChatInputCommandInteraction {
		let channel: any;
		const source =
			interactionSource ??
			this.serverState.channels.find(
				(channel) => channel.name === 'belle-bot-admin'
			);
		if (source !== undefined) {
			channel = Reflect.construct(TextChannel, [
				this.guild,
				source,
				this.client,
			]);
		}
		const interaction = Reflect.construct(ChatInputCommandInteraction, [
			this.client,
			{
				data: {
					...command,
					type: ApplicationCommandType.ChatInput,
				},
				id: BigInt(1),
				user: this.guildMember,
				type: InteractionType.ApplicationCommand,
				channel,
				entitlements: [],
			},
		]);

		// TODO: typing
		const mockReply = async (): Promise<any> => true;
		interaction.deferReply = vi.fn(mockReply);
		interaction.reply = vi.fn(mockReply);
		interaction.editReply = vi.fn(mockReply);
		interaction.guildId = this.guild.id;
		interaction.isCommand = vi.fn(() => true);
		return interaction;
	}

	private mockClient(): void {
		this.client = new Client({ intents: [] });
		this.client.login = vi.fn(() => Promise.resolve('LOGIN_TOKEN'));

		let currentId = 0;
		const makeId = () => `${currentId++}`;

		this.serverState = new ServerState();
		const serverState = this.serverState;

		this.client.rest.get = vi.fn(
			async (fullRoute: `/${string}`, options?: RequestData) => {
				if (fullRoute.match(new RegExp(Routes.channelPins('.*')))) {
					const [, channelId] = fullRoute.match(
						new RegExp(Routes.channelPins('(.*)'))
					);
					const channelMessages =
						serverState.messages.get(channelId) ?? [];
					const messages = channelMessages.filter(
						(message) => message.pinned
					);
					return messages;
				} else {
					expect.fail(
						`Unexpected GET request: ${fullRoute}. Mock fidelity must be increased.`
					);
				}
			}
		);

		this.client.rest.put = vi.fn(
			async (fullRoute: `/${string}`, options?: RequestData) => {
				if (
					fullRoute.match(new RegExp(Routes.channelPin('.*', '.*')))
				) {
					const [, channelId, messageId] = fullRoute.match(
						new RegExp(Routes.channelPin('(.*)', '(.*)'))
					);
					const newChannelMessages =
						serverState.messages.get(channelId) ?? [];
					const message = newChannelMessages.find(
						(message) => message.id === messageId
					);
					expect(message).toBeDefined();
					message.pinned = true;
					return message;
				} else {
					expect.fail(
						`Unexpected PUT request: ${fullRoute}. Mock fidelity must be increased.`
					);
				}
			}
		);
		this.client.rest.post = vi.fn(
			async (fullRoute: `/${string}`, options?: RequestData) => {
				if (fullRoute.match(new RegExp(Routes.guildChannels('.*')))) {
					expect(options.body).toBeInstanceOf(Object);
					const { body } = options as any;
					expect(body.name).toBeDefined();
					const channelType = body.type ?? ChannelType.GuildText;
					const sanitizedName = body.name
						.toLocaleLowerCase()
						.replaceAll(' ', '-');

					const channel: ChannelData = {
						id: makeId(),
						name: sanitizedName,
						type: channelType,
						guild_id: 'guild-id',
					};

					if ('parent_id' in body) {
						channel.parent_id = body.parent_id;
					}

					if (
						'permission_overwrites' in body &&
						body.permission_overwrites
					) {
						// Round trip this to avoid mutating the object passed in by the REST request.
						channel.permission_overwrites = JSON.parse(
							JSON.stringify(body.permission_overwrites)
						);
					}
					serverState.channels.push(channel);
					return channel;
				} else if (
					fullRoute.match(new RegExp(Routes.guildRoles('.*')))
				) {
					expect(options.body).toBeInstanceOf(Object);
					const role: RoleData = {
						id: makeId(),
						name: (options.body as any).name,
						mentionable: (options.body as any).mentionable ?? false,
					};
					serverState.roles.push(role);
					return role;
				} else if (
					fullRoute.match(new RegExp(Routes.channelMessages('.*')))
				) {
					const [, channelId] = fullRoute.match(
						/\/channels\/(.*)\/messages/
					);
					const message: MessageData = {
						id: makeId(),
						content: (options.body as any).content,
						channel_id: channelId,
						guild_id: 'guild-id',
						author: { id: FREDDIE_USER_ID, username: 'belle-bot' },
					};

					if ((options.body as any).embeds) {
						message.embeds = (options.body as any).embeds;
					}

					const newChannelMessages =
						serverState.messages.get(channelId) ?? [];
					newChannelMessages.push(message);
					serverState.messages.set(channelId, newChannelMessages);
					return message;
				} else {
					expect.fail(
						`Unexpected POST request: ${fullRoute}. Mock fidelity must be increased.`
					);
				}
			}
		);
		this.client.rest.patch = vi.fn(
			async (fullRoute: `/${string}`, options?: RequestData) => {
				if (
					fullRoute.match(
						new RegExp(Routes.channelMessage('.*', '.*'))
					)
				) {
					const [, channelId, messageId] = fullRoute.match(
						new RegExp(Routes.channelMessage('(.*)', '(.*)'))
					);
					const channelMessages =
						serverState.messages.get(channelId) ?? [];
					const message = channelMessages.find(
						(message) => message.id === messageId
					);

					if ((options.body as any).content) {
						message.content = (options.body as any).content;
					}
					if ((options.body as any).embeds) {
						message.embeds = (options.body as any).embeds;
					}
					return message;
				} else if (fullRoute.match(new RegExp(Routes.channel('.*')))) {
					const [, channelId] = fullRoute.match(
						new RegExp(Routes.channel('(.*)'))
					);
					const channel = serverState.findChannelBy('id', channelId);
					channel.name = (options.body as any).name ?? channel.name;
					return channel;
				} else {
					expect.fail(
						`Unexpected PATCH request: ${fullRoute}. Mock fidelity must be increased.`
					);
				}
			}
		);
		this.client.user = Reflect.construct(ClientUser, [
			this.client,
			{
				id: FREDDIE_USER_ID,
				bot: true,
			},
		]);
	}

	private mockGuild(): void {
		this.guild = Reflect.construct(Guild, [
			this.client,
			{
				unavailable: false,
				id: 'guild-id',
				name: 'mocked js guild',
				icon: 'mocked guild icon url',
				splash: 'mocked guild splash url',
				region: 'na-west',
				member_count: 42,
				large: false,
				features: [],
				application_id: 'application-id',
				afkTimeout: 1000,
				afk_channel_id: 'afk-channel-id',
				system_channel_id: 'system-channel-id',
				embed_enabled: true,
				verification_level: 2,
				explicit_content_filter: 3,
				mfa_level: 8,
				joined_at: new Date('2018-01-01').getTime(),
				owner_id: 'owner-id',
				channels: [],
				roles: [],
				presences: [],
				voice_states: [],
				emojis: [],
			},
		]);
	}

	private mockUser(): void {
		this.user = Reflect.construct(User, [
			this.client,
			{
				id: 'user-id',
				username: 'USERNAME',
				discriminator: 'user#0000',
				avatar: 'user avatar url',
				bot: false,
			},
		]);
	}

	private mockGuildMember(): void {
		this.guildMember = Reflect.construct(GuildMember, [
			this.client,
			{
				id: BigInt(1),
				deaf: false,
				mute: false,
				self_mute: false,
				self_deaf: false,
				session_id: 'session-id',
				channel_id: 'channel-id',
				nick: 'nick',
				joined_at: new Date('2020-01-01').getTime(),
				user: this.user,
				roles: [],
			},
			this.guild,
		]);
	}
}
