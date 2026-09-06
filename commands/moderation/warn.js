"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const Account = require('../../db/models/Account.js');
const { logAction } = require('../../utils/logger.js');
const { hasPermission } = require('../../utils/permissionChecker.js');

module.exports = {
    requiredPermission: 'moderateMembers',
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to warn')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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

        const hasAccess = await hasPermission(interaction.member, 'moderateMembers');
        if (!hasAccess) {
            await interaction.editReply({
                content: 'You do not have permission to use this command.'
            });
            return;
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        let account = await Account.findOne({ dcId: user.id, guildId: interaction.guildId });
        if (!account) {
            account = new Account({ dcId: user.id, guildId: interaction.guildId });
            try {
                await account.save();
            } catch (err) {
                if (err.code === 11000) {
                    account = await Account.findOne({ dcId: user.id, guildId: interaction.guildId });
                }
            }
        }

        const caseId = await logAction(
            interaction.client,
            interaction.guildId,
            'warn',
            user.id,
            interaction.user.id,
            reason,
            {},
            'mod'
        );

        account.warnings.push({
            reason,
            moderatorId: interaction.user.id,
            caseId
        });

        account.riskScore = Math.min(account.riskScore + 10, 100);
        await account.save();

        await interaction.editReply({
            ...createMessage({
                title: 'User Warned',
                data: {
                    'User': `${user.tag} (${user.id})`,
                    'Moderator': `${interaction.user.tag}`,
                    'Reason': reason,
                    'Case ID': `#${caseId}`,
                    'Warnings': account.warnings.length,
                    'Risk Score': `${account.riskScore}%`
                },
                color: COLORS.warning
            })
        });

        await user.send({
            ...createMessage({
                title: 'You Have Been Warned',
                data: {
                    'Server': interaction.guild.name,
                    'Reason': reason,
                    'Case ID': `#${caseId}`,
                    'Warnings': account.warnings.length
                },
                color: COLORS.warning
            })
        }).catch(() => {});
    }
};