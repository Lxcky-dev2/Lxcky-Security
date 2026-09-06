"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');

module.exports = {
  requiredPermission: 'banMembers',
  data: new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID')
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'banMembers'))) return interaction.editReply({ content: 'You do not have permission to use this command.' });
    const id = interaction.options.getString('userid', true).trim();
    if (!/^\d{17,20}$/.test(id)) return interaction.editReply({ content: 'Invalid user ID.' });
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const ban = await interaction.guild.bans.fetch(id).catch(() => null);
    if (!ban) return interaction.editReply({ content: 'That user is not banned.' });
    await interaction.guild.bans.remove(id, reason);
    const caseId = await logAction(interaction.client, interaction.guildId, 'unban', id, interaction.user.id, reason, {}, 'mod');
    return interaction.editReply(createMessage({ title: 'User Unbanned', data: { User: `${ban.user.tag} (${id})`, Moderator: interaction.user.tag, Reason: reason, 'Case ID': `#${caseId}` }, color: COLORS.success }));
  }
};
