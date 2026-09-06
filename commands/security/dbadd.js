"use strict";

const { SlashCommandBuilder } = require('discord.js');
const GlobalEntry = require('../../db/models/GlobalEntry.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasGlobalPermission, auditDatabase } = require('../../utils/ownerConfig.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dbadd')
        .setDescription('Add a user or bot to the global security database')
        .addStringOption(option => option
            .setName('userid')
            .setDescription('Discord User/Bot ID')
            .setRequired(true))
        .addStringOption(option => option
            .setName('reason')
            .setDescription('Reason')
            .setRequired(false))
        .addStringOption(option => option
            .setName('type')
            .setDescription('user or bot')
            .setRequired(false)
            .addChoices({ name: 'User', value: 'user' }, { name: 'Bot', value: 'bot' }))
        .addStringOption(option => option
            .setName('status')
            .setDescription('trusted, suspicious, or blacklisted')
            .setRequired(false)
            .addChoices(
                { name: 'Trusted', value: 'trusted' },
                { name: 'Suspicious', value: 'suspicious' },
                { name: 'Blacklisted', value: 'blacklisted' }
            )),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        if (!(await hasGlobalPermission(interaction.user.id, 'db.add'))) {
            return interaction.editReply({ content: 'You are not trusted to add entries to the global database.' });
        }

        const discordId = interaction.options.getString('userid', true).trim();
        if (!/^\d{17,20}$/.test(discordId)) {
            return interaction.editReply(createMessage({
                title: 'Invalid Discord ID',
                data: { Message: 'The supplied ID is not a valid Discord User/Bot ID.' },
                color: COLORS.danger
            }));
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';
        const type = interaction.options.getString('type') || 'user';
        const status = interaction.options.getString('status') || 'blacklisted';

        let entry = await GlobalEntry.findOne({ discordId });
        const action = entry && entry.active ? 'UPDATE' : 'ADD';

        if (!entry) {
            entry = new GlobalEntry({
                discordId,
                type,
                status,
                reason,
                addedBy: interaction.user.id,
                updatedBy: interaction.user.id,
                active: true
            });
        } else {
            entry.type = type;
            entry.status = status;
            entry.reason = reason;
            entry.updatedBy = interaction.user.id;
            entry.active = true;
        }

        await entry.save();

        await auditDatabase({
            action,
            discordId,
            type,
            status,
            reason,
            actorId: interaction.user.id,
            sourceGuildId: interaction.guildId
        });

        return interaction.editReply(createMessage({
            title: action === 'ADD' ? ' Database Entry Added' : ' Database Entry Updated',
            data: {
                'Discord ID': discordId,
                Type: type,
                Status: status,
                Reason: reason,
                'Changed By': interaction.user.tag
            },
            color: COLORS.success
        }));
    }
};
