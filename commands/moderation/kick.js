"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { logAction } = require('../../utils/logger.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const rateLimitManager = require('../../utils/rateLimitManager.js');

module.exports = {
    requiredPermission: 'kickMembers',
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to kick')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const hasAccess = await hasPermission(interaction.member, 'kickMembers');
        if (!hasAccess) {
            await interaction.editReply({
                content: 'You do not have permission to use this command.'
            });
            return;
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            await interaction.editReply({
                content: 'User is not in this server.'
            });
            return;
        }

        if (!member.kickable) {
            await interaction.editReply({
                content: 'I cannot kick this user. They may have higher permissions than me.'
            });
            return;
        }

        await rateLimitManager.enqueue(async () => {
            await member.kick(reason);
        });

        const caseId = await logAction(
            interaction.client,
            interaction.guildId,
            'kick',
            user.id,
            interaction.user.id,
            reason,
            {},
            'mod'
        );

        await interaction.editReply({
            ...createMessage({
                title: 'User Kicked',
                data: {
                    'User': `${user.tag} (${user.id})`,
                    'Moderator': `${interaction.user.tag}`,
                    'Reason': reason,
                    'Case ID': `#${caseId}`
                },
                color: COLORS.warning
            })
        });
    }
};