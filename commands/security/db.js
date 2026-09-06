"use strict";

const { SlashCommandBuilder } = require('discord.js');
const GlobalEntry = require('../../db/models/GlobalEntry.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasGlobalPermission, auditDatabase } = require('../../utils/ownerConfig.js');

const ID_RE = /^\d{17,20}$/;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('db')
        .setDescription('Global security database tools')
        .addSubcommand(s => s
            .setName('search')
            .setDescription('Search the global database')
            .addStringOption(o => o.setName('id').setDescription('Discord ID').setRequired(true)))
        .addSubcommand(s => s
            .setName('add')
            .setDescription('Add or update a global entry')
            .addStringOption(o => o.setName('id').setDescription('Discord ID').setRequired(true))
            .addStringOption(o => o.setName('type').setDescription('user or bot').setRequired(true)
                .addChoices({ name: 'User', value: 'user' }, { name: 'Bot', value: 'bot' }))
            .addStringOption(o => o.setName('status').setDescription('Entry status').setRequired(true)
                .addChoices(
                    { name: 'Trusted', value: 'trusted' },
                    { name: 'Suspicious', value: 'suspicious' },
                    { name: 'Blacklisted', value: 'blacklisted' }
                ))
            .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove a global entry')
            .addStringOption(o => o.setName('id').setDescription('Discord ID').setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const sub = interaction.options.getSubcommand();
        const permission = `db.${sub}`;

        if (!(await hasGlobalPermission(interaction.user.id, permission))) {
            return interaction.editReply({ content: 'You are not trusted to use this global database action.' });
        }

        const id = interaction.options.getString('id', true).trim();
        if (!ID_RE.test(id)) return interaction.editReply({ content: 'Invalid Discord ID.' });

        if (sub === 'search') {
            const entry = await GlobalEntry.findOne({ discordId: id, active: true });
            return interaction.editReply(entry
                ? createMessage({
                    title: ' Database Result',
                    data: {
                        ID: entry.discordId,
                        Type: entry.type,
                        Status: entry.status,
                        Reason: entry.reason,
                        'Added By': `<@${entry.addedBy}>`
                    },
                    color: entry.status === 'blacklisted' ? COLORS.danger : COLORS.default
                })
                : createMessage({
                    title: ' Database Result',
                    data: { Status: ' Not Found', ID: id, Message: 'This ID is not currently in the global database.' },
                    color: COLORS.warning
                })
            );
        }

        if (sub === 'add') {
            const type = interaction.options.getString('type', true);
            const status = interaction.options.getString('status', true);
            const reason = interaction.options.getString('reason', true);

            let entry = await GlobalEntry.findOne({ discordId: id });
            const action = entry?.active ? 'UPDATE' : 'ADD';

            if (!entry) {
                entry = new GlobalEntry({
                    discordId: id,
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
            await auditDatabase({ action, discordId: id, type, status, reason, actorId: interaction.user.id, sourceGuildId: interaction.guildId });

            return interaction.editReply(createMessage({
                title: action === 'ADD' ? ' Database Entry Added' : ' Database Entry Updated',
                data: { ID: id, Type: type, Status: status, Reason: reason },
                color: COLORS.success,
            }));
        }

        const entry = await GlobalEntry.findOne({ discordId: id, active: true });
        if (!entry) {
            return interaction.editReply(createMessage({
                title: 'Not Found',
                data: { ID: id, Status: 'Not in database' },
                color: COLORS.warning,
            }));
        }

        entry.active = false;
        entry.updatedBy = interaction.user.id;
        await entry.save();
        await auditDatabase({
            action: 'REMOVE',
            discordId: id,
            type: entry.type,
            status: entry.status,
            reason: entry.reason,
            actorId: interaction.user.id,
            sourceGuildId: interaction.guildId
        });

        return interaction.editReply(createMessage({
            title: ' Database Entry Removed',
            data: { ID: id, PreviousStatus: entry.status },
            color: COLORS.success,
            ephemeral: true
        }));
    }
};
