"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const Account = require('../../db/models/Account.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
module.exports = {
  requiredPermission: 'moderateMembers',
  data: new SlashCommandBuilder().setName('clearwarnings').setDescription('Clear a user\'s warnings')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'moderateMembers'))) return interaction.editReply({ content: 'You do not have permission to use this command.' });
    const user = interaction.options.getUser('user', true);
    const account = await Account.findOne({ dcId: user.id, guildId: interaction.guildId });
    if (!account) return interaction.editReply({ content: 'That user has no warning record.' });
    const count = account.warnings.length;
    account.warnings = [];
    await account.save();
    const reason = interaction.options.getString('reason') || 'Warnings cleared';
    const caseId = await logAction(interaction.client, interaction.guildId, 'clearwarnings', user.id, interaction.user.id, reason, { cleared: count }, 'mod');
    return interaction.editReply(createMessage({ title: 'Warnings Cleared', data: { User: `${user.tag} (${user.id})`, Cleared: count, Moderator: interaction.user.tag, Reason: reason, 'Case ID': `#${caseId}` }, color: COLORS.success }));
  }
};
