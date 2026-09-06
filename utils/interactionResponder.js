"use strict";

const { MessageFlags } = require('discord.js');

// Long-running component actions that intentionally produce a separate
// ephemeral response rather than editing the panel they came from.
function shouldDeferReply(customId) {
  return (
    /^ticket_open_/.test(customId) ||
    [
      'ticket_cfg_post',
      'ticket_close',
      'ticket_claim',
      'verify_user',
      'verify_apply',
      'verify_post',
      'report_investigate',
      'panel_ext_apply',
      'panel_ext_restore'
    ].includes(customId)
  );
}

// Long-running panel actions that should acknowledge by updating the original
// component message once the work has completed.
function shouldDeferUpdate(customId) {
  return (
    /^report_(resolve|ignore)_/.test(customId) ||
    /^owner_channel_set_/.test(customId) ||
    /^owner_staff_perm_pick_/.test(customId) ||
    /^staff_report_pick/.test(customId) ||
    /^links_(toggle|delete)_/.test(customId) ||
    [
      'panel_enable_all',
      'panel_disable_all',
      'panel_ext_always',
      'panel_ext_disabled',
      'panel_ext_monitor',
      'panel_ext_all',
      'ticket_cfg_preview',
      'ticket_cfg_toggle',
      'staff_reports',
      'staff_reports_open',
      'logs_toggle',
      'logs_clear',
      'logs_refresh',
      'settings_refresh',
      'settings_clear_all',
      'owner_refresh',
      'owner_channels',
      'owner_staff',
      'owner_servers',
      'owner_health',
      'owner_database',
      'owner_reports',
      'owner_stats',
      'owner_db_recent',
      'staff_home',
      'whitelist_refresh',
      'whitelist_remove',
      'localreport_investigate'
    ].includes(customId)
  );
}

function routeDeferredMethods(interaction, mode) {
  if (interaction.__lxckyDeferredRouting) return;
  interaction.__lxckyDeferredRouting = true;

  if (mode === 'reply') {
    interaction.reply = (payload) => interaction.editReply(payload);
    interaction.update = (payload) => interaction.editReply(payload);
  } else {
    interaction.reply = (payload) => interaction.followUp(payload);
    interaction.update = (payload) => interaction.editReply(payload);
  }
}

async function autoDeferComponent(interaction) {
  if (!interaction || !interaction.customId || interaction.replied || interaction.deferred) return;

  const id = interaction.customId;

  if (shouldDeferReply(id)) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    routeDeferredMethods(interaction, 'reply');
    return;
  }

  if (shouldDeferUpdate(id)) {
    await interaction.deferUpdate();
    routeDeferredMethods(interaction, 'update');
  }
}

module.exports = { autoDeferComponent, shouldDeferReply, shouldDeferUpdate };
