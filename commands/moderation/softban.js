"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
const rateLimitManager = require('../../utils/rateLimitManager.js');
module.exports = {
  requiredPermission: 'banMembers',
  data: new SlashCommandBuilder().setName('softban').setDescription('Ban and immediately unban a user to clear recent messages')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'banMembers'))) return interaction.editReply({ content: 'You do not have permission to use this command.' });
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && !member.bannable) return interaction.editReply({ content: 'I cannot ban this user.' });
    await rateLimitManager.enqueue(async () => {
      await interaction.guild.bans.create(user.id, { reason, deleteMessageSeconds: 604800 });
      await interaction.guild.bans.remove(user.id, `${reason} (softban)`);
    });
    const caseId = await logAction(interaction.client, interaction.guildId, 'softban', user.id, interaction.user.id, reason, {}, 'mod');
    return interaction.editReply(createMessage({ title: 'User Softbanned', data: { User: `${user.tag} (${user.id})`, Moderator: interaction.user.tag, Reason: reason, 'Case ID': `#${caseId}` }, color: COLORS.warning }));
  }
};
