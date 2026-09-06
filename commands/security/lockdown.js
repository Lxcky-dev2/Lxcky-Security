"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { triggerRaidMode, restoreRaidMode } = require('../../utils/antiRaid.js');
const { getGuildSettings } = require('../../utils/securityPanels.js');
const { hasPermission } = require('../../utils/permissionChecker.js');

module.exports = {
    requiredPermission: 'administrator',
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Emergency lockdown - disables external apps and enables verification')
        .addStringOption(option => 
            option.setName('action')
                .setDescription('start or stop lockdown')
                .setRequired(true)
                .addChoices(
                    { name: 'Start', value: 'start' },
                    { name: 'Stop', value: 'stop' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const hasAccess = await hasPermission(interaction.member, 'administrator');
        if (!hasAccess) {
            await interaction.editReply({
                content: 'You do not have permission to use this command.'
            });
            return;
        }

        const action = interaction.options.getString('action');
        const settings = await getGuildSettings(interaction.guildId);

        if (action === 'start') {
            await triggerRaidMode(interaction.guild, settings);
            await interaction.editReply({
                ...createMessage({
                    title: 'Lockdown Activated',
                    data: {
                        'Status': 'Emergency lockdown is now active',
                        'Action': 'External apps disabled in all channels',
                        'Verification Level': 'Set to Medium'
                    },
                    color: COLORS.danger
                })
            });
        } else if (action === 'stop') {
            await restoreRaidMode(interaction.guild, settings);
            await interaction.editReply({
                ...createMessage({
                    title: 'Lockdown Deactivated',
                    data: {
                        'Status': 'Lockdown has been lifted',
                        'Action': 'External apps re-enabled',
                        'Verification Level': 'Reset to None'
                    },
                    color: COLORS.success
                })
            });
        }
    }
};