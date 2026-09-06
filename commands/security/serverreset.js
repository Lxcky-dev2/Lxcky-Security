"use strict";

const {
    SlashCommandBuilder,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
} = require("discord.js");
const { isOwner } = require("../../utils/ownerConfig.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("serverreset")
        .setDescription("Owner-only: delete every channel in a server and create three fresh text channels")
        .addStringOption(option =>
            option
                .setName("server_id")
                .setDescription("The Discord server ID to reset")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("confirm")
                .setDescription('Type RESET exactly to confirm this irreversible action')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({
                content: "This command is owner-only.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const serverId = interaction.options.getString("server_id", true).trim();
        const confirmation = interaction.options.getString("confirm", true).trim();

        if (!/^\d{17,20}$/.test(serverId)) {
            return interaction.reply({
                content: "That is not a valid Discord server ID.",
                flags: MessageFlags.Ephemeral,
            });
        }

        if (confirmation !== "RESET") {
            return interaction.reply({
                content: 'This action is destructive. Type `RESET` exactly in the confirm option to continue.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const guild = interaction.client.guilds.cache.get(serverId);
        if (!guild) {
            return interaction.reply({
                content: "The bot is not currently in that server.",
                flags: MessageFlags.Ephemeral,
            });
        }

        // Deleting an entire server's channels is intentionally destructive.
        // Require the bot itself to have Manage Channels before proceeding.
        const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
        if (!me || !me.permissions.has("ManageChannels")) {
            return interaction.reply({
                content: "I do not have Manage Channels permission in that server.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channels = [...guild.channels.cache.values()];
        const nonCategories = channels.filter(channel => channel.type !== ChannelType.GuildCategory);
        const categories = channels.filter(channel => channel.type === ChannelType.GuildCategory);

        let deleted = 0;
        let failed = 0;

        // Delete children first, then categories.
        for (const channel of [...nonCategories, ...categories]) {
            try {
                await channel.delete("Owner server reset");
                deleted++;
            } catch (error) {
                failed++;
                console.error(`[SERVER RESET] Failed to delete ${channel.id} (${channel.name}):`, error?.message || error);
            }
        }

        const created = [];
        for (const name of ["General", "announcements", "news"]) {
            try {
                const channel = await guild.channels.create({
                    name,
                    type: ChannelType.GuildText,
                    reason: "Owner server reset",
                });
                created.push(channel);
            } catch (error) {
                failed++;
                console.error(`[SERVER RESET] Failed to create ${name}:`, error?.message || error);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("Server Reset Complete")
            .setDescription(`Reset **${guild.name}** (${guild.id}).`)
            .addFields(
                { name: "Deleted", value: String(deleted), inline: true },
                { name: "Failed", value: String(failed), inline: true },
                {
                    name: "Created",
                    value: created.length ? created.map(channel => `<#${channel.id}>`).join(", ") : "None",
                    inline: false,
                },
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};
