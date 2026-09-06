"use strict";

const { SlashCommandBuilder } = require('discord.js');
const { buildSecurityPanel, getGuildSettings } = require('../../utils/securityPanels.js');
const { hasPermission } = require('../../utils/permissionChecker.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('View security status (admins can toggle features)'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (error) {
            await interaction.reply({
                content: 'Command timed out. Please try again.',
                ephemeral: true
            }).catch(() => {});
            return;
        }

        const settings = await getGuildSettings(interaction.guildId);
        settings.guildName = interaction.guild.name;
        await settings.save();

        const isAdmin = await hasPermission(interaction.member, 'admin');
        const panel = buildSecurityPanel(settings, isAdmin);
        await interaction.editReply(panel);
    }
};