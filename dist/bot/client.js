"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = exports.ExtendedClient = void 0;
const discord_js_1 = require("discord.js");
class ExtendedClient extends discord_js_1.Client {
    commands;
    constructor() {
        super({
            intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMembers, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.GuildMessageReactions, discord_js_1.GatewayIntentBits.MessageContent, discord_js_1.GatewayIntentBits.GuildModeration, discord_js_1.GatewayIntentBits.GuildPresences],
            makeCache: discord_js_1.Options.cacheWithLimits({
                MessageManager: 100,
                PresenceManager: 50,
                GuildMemberManager: 250,
                UserManager: 1500,
                ReactionManager: 25,
                ThreadManager: 50,
            }),
            sweepers: {
                messages: { interval: 300, lifetime: 900 },
            },
            partials: [discord_js_1.Partials.Channel, discord_js_1.Partials.Message, discord_js_1.Partials.Reaction, discord_js_1.Partials.User, discord_js_1.Partials.GuildMember],
        });
        this.commands = new discord_js_1.Collection();
    }
}
exports.ExtendedClient = ExtendedClient;
exports.client = new ExtendedClient();
