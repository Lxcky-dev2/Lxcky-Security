"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
module.exports = {
  requiredPermission: 'manageNicknames',
  data: new SlashCommandBuilder().setName('nick').setDescription('Change or clear a member nickname')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('nickname').setDescription('New nickname; leave empty to clear').setRequired(false).setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'manageNicknames'))) return interaction.editReply({ content: 'You do not have permission to manage nicknames.' });
    const user = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.editReply({ content: 'User is not in this server.' });
    if (!member.manageable) return interaction.editReply({ content: 'I cannot change this member nickname.' });
    const nickname = interaction.options.getString('nickname');
    await member.setNickname(nickname || null, `Changed by ${interaction.user.tag}`);
    const caseId = await logAction(interaction.client, interaction.guildId, 'nick', user.id, interaction.user.id, nickname ? `Set nickname to ${nickname}` : 'Nickname cleared', {}, 'mod');
    return interaction.editReply(createMessage({ title: 'Nickname Updated', data: { User: `${user.tag} (${user.id})`, Nickname: nickname || 'Cleared', Moderator: interaction.user.tag, 'Case ID': `#${caseId}` }, color: COLORS.success }));
  }
};
