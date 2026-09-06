"use strict";

const { createMessage, COLORS } = require('./componentBuilder.js');
const SecurityReport = require('../db/models/SecurityReport.js');
const { isOwner } = require('./permissionChecker.js');
const { getMainGuild } = require('./centralReporting.js');

async function handleOwnerPanel(interaction) {
  if (!isOwner(interaction)) return interaction.reply({ content: 'Owner only.', ephemeral: true });
  if (interaction.customId === 'owner_refresh') {
    const command = require('../commands/security/owner.js');
    return command.renderOwnerDashboard(interaction);
  }
  if (interaction.customId === 'owner_servers') {
    const guilds = interaction.client.guilds.cache;
    const lines = guilds.map(g => `• **${g.name}** — ${g.memberCount ?? '?'} members — \`${g.id}\``).slice(0, 20).join('\n');
    return interaction.reply({ ...createMessage({ title: `Servers (${guilds.size})`, data: { List: lines || 'None' }, color: COLORS.default, ephemeral: true }) });
  }
}

async function handleReportPanel(interaction) {
  if (!isOwner(interaction)) return interaction.reply({ content: 'Owner only.', ephemeral: true });
  const [_, action, reportId] = interaction.customId.split('_');
  if (!reportId) return interaction.reply({ content: 'Invalid report.', ephemeral: true });

  const status = action === 'review' ? 'reviewed' : action === 'dismiss' ? 'dismissed' : null;
  if (!status) return;
  const report = await SecurityReport.findOneAndUpdate({ reportId }, { status }, { new: true });
  if (!report) return interaction.reply({ content: 'Report not found.', ephemeral: true });

  await interaction.update({ ...createMessage({ title: 'Report Updated', data: { 'Report ID': reportId, Status: status, 'Updated By': interaction.user.tag }, color: status === 'dismissed' ? COLORS.warning : COLORS.success }), components: [] });
}

module.exports = { handleOwnerPanel, handleReportPanel };
