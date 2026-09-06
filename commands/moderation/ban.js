"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const Account = require('../../db/models/Account.js');
const GlobalEntry = require('../../db/models/GlobalEntry.js');
const { auditDatabase } = require('../../utils/ownerConfig.js');
const { logAction } = require('../../utils/logger.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const rateLimitManager = require('../../utils/rateLimitManager.js');

module.exports = {
    requiredPermission: 'banMembers',
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to ban')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(true)
        )
        .addBooleanOption(option => 
            option.setName('global')
                .setDescription('Add to global blacklist (default: false)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

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

        const hasAccess = await hasPermission(interaction.member, 'banMembers');
        if (!hasAccess) {
            await interaction.editReply({
                content: 'You do not have permission to use this command.'
            });
            return;
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const global = interaction.options.getBoolean('global') || false;

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (member && !member.bannable) {
            await interaction.editReply({
                content: 'I cannot ban this user. They may have higher permissions than me.'
            });
            return;
        }

        await rateLimitManager.enqueue(async () => {
            if (member) {
                await member.ban({ reason });
            } else {
                await interaction.guild.bans.create(user.id, { reason });
            }
        });

        // Fix: metadata should be an object, not the reason
        const metadata = { global: global ? 'Yes' : 'No' };
        
        const caseId = await logAction(
            interaction.client,
            interaction.guildId,
            'ban',
            user.id,
            interaction.user.id,
            reason,
            metadata,
            'mod'
        );

        if (global) {
            let globalEntry = await GlobalEntry.findOne({ discordId: user.id });
            const action = !globalEntry || !globalEntry.active ? 'ADD' : 'UPDATE';

            if (!globalEntry) {
                globalEntry = new GlobalEntry({
                    discordId: user.id,
                    type: user.bot ? 'bot' : 'user',
                    status: 'blacklisted',
                    reason: reason || 'No reason provided',
                    addedBy: interaction.user.id,
                    updatedBy: interaction.user.id,
                    active: true
                });
            } else {
                globalEntry.type = user.bot ? 'bot' : 'user';
                globalEntry.status = 'blacklisted';
                globalEntry.reason = reason || 'No reason provided';
                globalEntry.updatedBy = interaction.user.id;
                globalEntry.active = true;
            }

            await globalEntry.save();
            await auditDatabase({
                action,
                discordId: user.id,
                type: globalEntry.type,
                status: globalEntry.status,
                reason: globalEntry.reason,
                actorId: interaction.user.id,
                sourceGuildId: interaction.guildId
            });
        }

        let account = await Account.findOne({ dcId: user.id, guildId: interaction.guildId });
        if (!account) {
            account = new Account({ dcId: user.id, guildId: interaction.guildId });
        }
        account.riskScore = 100;
        await account.save();

        await interaction.editReply({
            ...createMessage({
                title: 'User Banned',
                data: {
                    'User': `${user.tag} (${user.id})`,
                    'Moderator': `${interaction.user.tag}`,
                    'Reason': reason,
                    'Case ID': `#${caseId}`,
                    'Global Blacklist': global ? 'Added' : 'Not added'
                },
                color: COLORS.danger
            })
        });
    }
};