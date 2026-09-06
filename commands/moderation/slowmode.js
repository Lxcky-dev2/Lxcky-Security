"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
module.exports = {
  requiredPermission: 'manageChannels',
  data: new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode')
    .addIntegerOption(o => o.setName('seconds').setDescription('0-21600 seconds').setRequired(true).setMinValue(0).setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!(await hasPermission(interaction.member, 'manageChannels'))) return interaction.editReply({ content: 'You do not have permission to manage channels.' });
    if (!interaction.channel?.setRateLimitPerUser) return interaction.editReply({ content: 'This channel does not support slowmode.' });
    const seconds = interaction.options.getInteger('seconds', true);
    await interaction.channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
    const caseId = await logAction(interaction.client, interaction.guildId, 'slowmode', interaction.user.id, interaction.user.id, `Set to ${seconds} seconds`, { channelId: interaction.channelId }, 'mod');
    return interaction.editReply(createMessage({ title: 'Slowmode Updated', data: { Channel: `<#${interaction.channelId}>`, Seconds: seconds, Moderator: interaction.user.tag, 'Case ID': `#${caseId}` }, color: COLORS.success }));
  }
};
