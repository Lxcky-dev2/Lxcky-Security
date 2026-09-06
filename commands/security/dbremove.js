"use strict";

const { SlashCommandBuilder } = require('discord.js');
const GlobalEntry = require('../../db/models/GlobalEntry.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasGlobalPermission, auditDatabase } = require('../../utils/ownerConfig.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dbremove')
        .setDescription('Remove an entry from the global security database')
        .addStringOption(option => option
            .setName('userid')
            .setDescription('Discord User/Bot ID')
            .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        if (!(await hasGlobalPermission(interaction.user.id, 'db.remove'))) {
            return interaction.editReply({ content: 'You are not trusted to remove entries from the global database.' });
        }

        const discordId = interaction.options.getString('userid', true).trim();
        if (!/^\d{17,20}$/.test(discordId)) {
            return interaction.editReply(createMessage({
                title: 'Invalid Discord ID',
                data: { Message: 'The supplied ID is not a valid Discord User/Bot ID.' },
                color: COLORS.danger
            }));
        }

        const entry = await GlobalEntry.findOne({ discordId, active: true });
        if (!entry) {
            return interaction.editReply(createMessage({
                title: 'Not Found',
                data: { 'Discord ID': discordId, Status: 'This ID is not currently active in the global database.' },
                color: COLORS.warning
            }));
        }

        entry.active = false;
        entry.updatedBy = interaction.user.id;
        await entry.save();

        await auditDatabase({
            action: 'REMOVE',
            discordId,
            type: entry.type,
            status: entry.status,
            reason: entry.reason,
            actorId: interaction.user.id,
            sourceGuildId: interaction.guildId
        });

        return interaction.editReply(createMessage({
            title: ' Database Entry Removed',
            data: {
                'Discord ID': discordId,
                'Previous Type': entry.type,
                'Previous Status': entry.status,
                'Removed By': interaction.user.tag
            },
            color: COLORS.success
        }));
    }
};
