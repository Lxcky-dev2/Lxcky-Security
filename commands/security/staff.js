"use strict";

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getStaff, hasGlobalPermission } = require('../../utils/ownerConfig.js');
const { staffPanel } = require('../../utils/staffPanel.js');
const { isOwner } = require('../../utils/ownerConfig.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Open the trusted staff control panel'),

    async execute(interaction) {
        const allowed = isOwner(interaction.user.id) || !!(await getStaff(interaction.user.id));
        if (!allowed) {
            return interaction.reply({
                content: 'This panel is only available to trusted security staff.',
                flags: 64
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const staff = await getStaff(interaction.user.id);
            return interaction.editReply(await staffPanel(interaction, staff));
        } catch (error) {
            console.error('[STAFF] Panel failed:', error);
            return interaction.editReply({ content: 'Failed to load the staff panel.' });
        }
    }
};
