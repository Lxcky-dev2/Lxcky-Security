"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
module.exports = {
  requiredPermission: 'manageMessages',
  data: new SlashCommandBuilder().setName('purge').setDescription('Delete up to 100 messages from this channel')
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages, 1-100').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'manageMessages'))) return interaction.editReply({ content: 'You do not have permission to delete messages.' });
    if (!interaction.channel?.isTextBased() || !interaction.channel.messages?.fetch) return interaction.editReply({ content: 'This command cannot be used here.' });
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    const fetched = await interaction.channel.messages.fetch({ limit: 100 });
    let messages = [...fetched.values()];
    if (user) messages = messages.filter(m => m.author.id === user.id);
    messages = messages.slice(0, amount);
    if (!messages.length) return interaction.editReply({ content: 'No matching messages were found.' });
    const deletable = messages.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
    if (deletable.length === 1) await deletable[0].delete();
    else if (deletable.length > 1) await interaction.channel.bulkDelete(deletable, true);
    const caseId = await logAction(interaction.client, interaction.guildId, 'purge', interaction.user.id, interaction.user.id, user ? `Messages from ${user.tag}` : 'Channel purge', { amount: deletable.length, channelId: interaction.channelId, filterUserId: user?.id || null }, 'mod');
    return interaction.editReply(createMessage({ title: 'Messages Purged', data: { Channel: `<#${interaction.channelId}>`, Deleted: deletable.length, Moderator: interaction.user.tag, Filter: user ? `${user.tag}` : 'None', 'Case ID': `#${caseId}` }, color: COLORS.success }));
  }
};
