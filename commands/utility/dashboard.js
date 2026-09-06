"use strict";

const { buildDashboard, getUserAccount } = require('../../utils/userDashboard.js');
const GlobalEntry = require('../../db/models/GlobalEntry.js');
const { SlashCommandBuilder } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('View your security dashboard'),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        try {
            const account = await getUserAccount(interaction.user.id, interaction.guildId);
            const globalBlacklist = await GlobalEntry.findOne({
                discordId: interaction.user.id,
                active: true,
                status: 'blacklisted'
            });

            await interaction.editReply(buildDashboard(
                account,
                interaction.user,
                !!globalBlacklist
            ));
        } catch (error) {
            console.error('[DASHBOARD] Failed:', error);
            await interaction.editReply(createMessage({
                title: 'Dashboard Error',
                data: { Message: 'Unable to load your dashboard right now.' },
                color: COLORS.danger,
                ephemeral: true
            })).catch(() => {});
        }
    }
};
