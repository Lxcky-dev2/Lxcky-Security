"use strict";

const GuildSettings = require('../db/models/GuildSettings.js');

const TEXT_TYPES = new Set([0, 5, 10, 11, 12, 15]);

function relevantChannels(guild, settings) {
  if (settings.antiRaidExternalAllChannels) {
    return [...guild.channels.cache.values()].filter(channel => TEXT_TYPES.has(channel.type) && channel.permissionOverwrites);
  }
  return (settings.antiRaidExternalChannelIds || [])
    .map(id => guild.channels.cache.get(id))
    .filter(channel => channel && channel.permissionOverwrites && TEXT_TYPES.has(channel.type));
}

function isBypassed(settings, userId, roleIds = []) {
  if (userId && (settings.antiRaidExternalBypassUserIds || []).includes(userId)) return true;
  return roleIds.some(id => (settings.antiRaidExternalBypassRoleIds || []).includes(id));
}

async function snapshotAndBlock(guild, settings) {
  if (!['duringRaid', 'always'].includes(settings.antiRaidExternalMode)) return {changed: 0, skipped: true};
  const snapshots = settings.antiRaidExternalSnapshots || {};
  let changed = 0;

  for (const channel of relevantChannels(guild, settings)) {
    const existing = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
    if (!snapshots[channel.id]) {
      let state = 'none';
      if (existing?.allow?.has('UseExternalApps')) state = 'allow';
      if (existing?.deny?.has('UseExternalApps')) state = 'deny';
      snapshots[channel.id] = {everyone: state};
    }
    await channel.permissionOverwrites.edit(guild.roles.everyone, { UseExternalApps: false }, { reason: 'lxcky Security external app protection' }).catch(() => {});
    changed++;
  }

  // Explicitly allow configured bypass roles/users at the role level.
  for (const roleId of settings.antiRaidExternalBypassRoleIds || []) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    for (const channel of relevantChannels(guild, settings)) {
      await channel.permissionOverwrites.edit(role, { UseExternalApps: true }, { reason: 'lxcky Security external app bypass role' }).catch(() => {});
    }
  }

  settings.antiRaidExternalSnapshots = snapshots;
  await settings.save();
  return {changed, skipped: false};
}

async function restore(guild, settings) {
  const snapshots = settings.antiRaidExternalSnapshots || {};
  let restored = 0;
  for (const [channelId, state] of Object.entries(snapshots)) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.permissionOverwrites) continue;
    const value = state.everyone === 'allow' ? true : state.everyone === 'deny' ? false : null;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { UseExternalApps: value }, { reason: 'lxcky Security external app protection restore' }).catch(() => {});
    restored++;
    for (const roleId of settings.antiRaidExternalBypassRoleIds || []) {
      const role = guild.roles.cache.get(roleId);
      if (role) await channel.permissionOverwrites.delete(role.id, 'Restore external app bypass overwrite').catch(() => {});
    }
  }
  settings.antiRaidExternalSnapshots = {};
  await settings.save();
  return restored;
}

async function applyToNewChannel(channel) {
  if (!channel?.guild || !channel.permissionOverwrites || !TEXT_TYPES.has(channel.type)) return;
  const settings = await GuildSettings.findOne({guildId:channel.guild.id});
  if (!settings || settings.antiRaidExternalMode !== 'always') return;
  if (!settings.antiRaidExternalAllChannels && !(settings.antiRaidExternalChannelIds || []).includes(channel.id)) return;
  const snapshots = settings.antiRaidExternalSnapshots || {};
  const existing = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
  snapshots[channel.id] = {everyone: existing?.allow?.has('UseExternalApps') ? 'allow' : existing?.deny?.has('UseExternalApps') ? 'deny' : 'none'};
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {UseExternalApps:false}, {reason:'lxcky Security external app protection'}).catch(()=>{});
  settings.antiRaidExternalSnapshots = snapshots;
  await settings.save();
}

module.exports = { snapshotAndBlock, restore, applyToNewChannel, relevantChannels, isBypassed };
