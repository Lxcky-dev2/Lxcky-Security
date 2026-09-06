"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');

module.exports = {
  requiredPermission: 'moderateMembers',
  data: new SlashCommandBuilder().setName('untimeout').setDescription('Remove a timeout from a user')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'moderateMembers'))) return interaction.editReply({ content: 'You do not have permission to use this command.' });
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.editReply({ content: 'User is not in this server.' });
    if (!member.moderatable) return interaction.editReply({ content: 'I cannot modify this member.' });
    await member.timeout(null, reason);
    const caseId = await logAction(interaction.client, interaction.guildId, 'untimeout', user.id, interaction.user.id, reason, {}, 'mod');
    return interaction.editReply(createMessage({ title: 'Timeout Removed', data: { User: `${user.tag} (${user.id})`, Moderator: interaction.user.tag, Reason: reason, 'Case ID': `#${caseId}` }, color: COLORS.success }));
  }
};
