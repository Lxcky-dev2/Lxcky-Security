"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
module.exports = {
  requiredPermission: 'manageRoles',
  data: new SlashCommandBuilder().setName('role').setDescription('Add or remove a role from a member')
    .addSubcommand(s => s.setName('add').setDescription('Add a role').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addRoleOption(o=>o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a role').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addRoleOption(o=>o.setName('role').setDescription('Role').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'manageRoles'))) return interaction.editReply({ content: 'You do not have permission to manage roles.' });
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.editReply({ content: 'User is not in this server.' });
    if (role.managed || role.position >= interaction.guild.members.me.roles.highest.position) return interaction.editReply({ content: 'I cannot manage that role.' });
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      if (member.roles.cache.has(role.id)) return interaction.editReply({ content: 'That user already has the role.' });
      await member.roles.add(role, `Added by ${interaction.user.tag}`);
    } else {
      if (!member.roles.cache.has(role.id)) return interaction.editReply({ content: 'That user does not have the role.' });
      await member.roles.remove(role, `Removed by ${interaction.user.tag}`);
    }
    const caseId = await logAction(interaction.client, interaction.guildId, `role_${sub}`, user.id, interaction.user.id, `${role.name}`, { roleId: role.id }, 'mod');
    return interaction.editReply(createMessage({ title: `Role ${sub === 'add' ? 'Added' : 'Removed'}`, data: { User: `${user.tag} (${user.id})`, Role: `<@&${role.id}>`, Moderator: interaction.user.tag, 'Case ID': `#${caseId}` }, color: COLORS.success }));
  }
};
