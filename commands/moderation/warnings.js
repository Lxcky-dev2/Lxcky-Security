"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const Account = require('../../db/models/Account.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
module.exports = {
  requiredPermission: 'moderateMembers',
  data: new SlashCommandBuilder().setName('warnings').setDescription('View a user\'s warnings')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'moderateMembers'))) return interaction.editReply({ content: 'You do not have permission to use this command.' });
    const user = interaction.options.getUser('user', true);
    const account = await Account.findOne({ dcId: user.id, guildId: interaction.guildId });
    const warnings = account?.warnings || [];
    const data = { User: `${user.tag} (${user.id})`, Count: warnings.length, 'Risk Score': `${account?.riskScore ?? 0}%` };
    warnings.slice(-10).forEach((w, i) => { data[`Warning ${i + 1}`] = `${w.reason || 'No reason'}${w.caseId ? ` (${w.caseId})` : ''}`; });
    return interaction.editReply(createMessage({ title: 'User Warnings', data, color: warnings.length ? COLORS.warning : COLORS.success }));
  }
};
