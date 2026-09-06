"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildSettingsPanel } = require('../../utils/settingsPanel.js');
const { getGuildSettings } = require('../../utils/securityPanels.js');
const { hasPermission } = require('../../utils/permissionChecker.js');

module.exports = {
    requiredPermission: 'manageGuild',
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure log channels and server settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

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

        const hasAccess = await hasPermission(interaction.member, 'admin');
        if (!hasAccess) {
            await interaction.editReply({
                content: 'You do not have permission to use this command.'
            });
            return;
        }

        const settings = await getGuildSettings(interaction.guildId);
        settings.guildName = interaction.guild.name;
        await settings.save();

        await interaction.editReply(buildSettingsPanel(settings, interaction.guild));
    }
};