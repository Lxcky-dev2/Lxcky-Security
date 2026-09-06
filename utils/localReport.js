"use strict";

const { MessageFlags } = require('discord.js');
const { createMessage, createActionRow, createButton, COLORS } = require('./componentBuilder.js');
const { hasPermission } = require('./permissionChecker.js');

async function handleLocalReportComponent(interaction) {
    const [, action, userId] = interaction.customId.split('_');

    if (!userId) {
        return interaction.reply({
            content: 'Invalid report action.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!(await hasPermission(interaction.member, 'mod'))) {
        return interaction.reply({
            content: 'You need a moderation permission to handle this report.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (action === 'dismiss') {
        return interaction.update(createMessage({
            title: ' Report Dismissed',
            data: {
                'Reported User': `<@${userId}> (${userId})`,
                DismissedBy: interaction.user.tag,
                Status: 'Dismissed by server staff'
            },
            color: COLORS.success
        }));
    }

    if (action === 'investigate') {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const user = member?.user || await interaction.client.users.fetch(userId).catch(() => null);

        return interaction.update(createMessage({
            title: ' User Report Investigation',
            data: {
                User: user ? `${user.tag} (${user.id})` : userId,
                'Account Created': user?.createdAt ? user.createdAt.toUTCString() : 'Unknown',
                'Current Member': member ? 'Yes' : 'No',
                Roles: member ? member.roles.cache.map(r => r.name).filter(Boolean).join(', ') || 'None' : 'Unknown'
            },
            color: COLORS.warning,
            components: [createActionRow(
                createButton({ label: 'Dismiss', customId: `localreport_dismiss_${userId}`, style: 'secondary' })
            )]
        }));
    }

    return interaction.reply({
        content: 'Unknown report action.',
        flags: MessageFlags.Ephemeral
    });
}

module.exports = { handleLocalReportComponent };
