"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const Account = require('../../db/models/Account.js');
const { logAction } = require('../../utils/logger.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const rateLimitManager = require('../../utils/rateLimitManager.js');

module.exports = {
    requiredPermission: 'moderateMembers',
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout (mute) a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to timeout')
                .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('minutes')
                .setDescription('Duration in minutes (1-60)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(60)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for the timeout')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const hasAccess = await hasPermission(interaction.member, 'moderateMembers');
        if (!hasAccess) {
            await interaction.editReply({
                content: 'You do not have permission to use this command.'
            });
            return;
        }

        const user = interaction.options.getUser('user');
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason');

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            await interaction.editReply({
                content: 'User is not in this server.'
            });
            return;
        }

        if (!member.moderatable) {
            await interaction.editReply({
                content: 'I cannot timeout this user. They may have higher permissions than me.'
            });
            return;
        }

        const duration = minutes * 60 * 1000;
        const until = new Date(Date.now() + duration);

        await rateLimitManager.enqueue(async () => {
            await member.timeout(until, reason);
        });

        const caseId = await logAction(
            interaction.client,
            interaction.guildId,
            'timeout',
            user.id,
            interaction.user.id,
            reason,
            { duration: `${minutes} minutes`, until: until.toUTCString() },
            'mod'
        );

        // Update account
        let account = await Account.findOne({ dcId: user.id, guildId: interaction.guildId });
        if (!account) {
            account = new Account({ dcId: user.id, guildId: interaction.guildId });
        }
        account.activeTimeout = {
            until,
            reason,
            moderatorId: interaction.user.id
        };
        await account.save();

        await interaction.editReply({
            ...createMessage({
                title: 'User Timed Out',
                data: {
                    'User': `${user.tag} (${user.id})`,
                    'Moderator': `${interaction.user.tag}`,
                    'Duration': `${minutes} minutes`,
                    'Until': until.toUTCString(),
                    'Reason': reason,
                    'Case ID': `#${caseId}`
                },
                color: COLORS.warning
            })
        });
    }
};