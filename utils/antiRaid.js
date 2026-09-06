"use strict";
const GuildSettings = require('../db/models/GuildSettings.js');
const rateLimitManager = require('./rateLimitManager.js');
const { createMessage, COLORS } = require('./componentBuilder.js');
const { logAlert } = require('./logger.js');
const externalApp = require('./externalAppProtection.js');

const joinCache = new Map();
const raidActive = new Map();

async function checkRaid(member) {
  const settings = await GuildSettings.findOne({ guildId: member.guild.id });
  if (!settings || !settings.antiRaid) return;
  const guildId = member.guild.id;
  const now = Date.now();
  const joins = (joinCache.get(guildId) || []).filter(t => now - t < Math.max(5, Number(settings.timeWindow || 30) * 1000));
  joins.push(now);
  joinCache.set(guildId, joins);
  if (joins.length >= Math.max(2, Number(settings.joinThreshold || 10))) {
    if (raidActive.get(guildId)) return;
    raidActive.set(guildId, true);
    await triggerRaidMode(member.guild, settings);
  }
}

async function triggerRaidMode(guild, settings) {
  const result = await externalApp.snapshotAndBlock(guild, settings).catch(() => ({changed:0}));
  const alertChannel = settings.alertChannelId ? guild.channels.cache.get(settings.alertChannelId) : null;
  const data = {
    Status: 'Server is under raid protection',
    'External App Mode': settings.antiRaidExternalMode,
    'Channels Protected': String(result.changed || 0),
    'Verification Level': 'Medium',
    Duration: `${Math.max(1, Number(settings.lockdownDuration || 5))} minutes`
  };
  await rateLimitManager.enqueue(() => guild.setVerificationLevel(2)).catch(() => {});
  if (alertChannel?.isTextBased()) await alertChannel.send({ ...createMessage({title:'Raid Mode Activated',data,color:COLORS.danger}) }).catch(()=>{});
  await logAlert(global.client, guild.id, 'Anti-Raid Incident', data, COLORS.danger).catch(()=>{});
  const duration = Math.max(1, Number(settings.lockdownDuration || 5)) * 60_000;
  setTimeout(() => restoreRaidMode(guild, settings).catch(err => console.error('[ANTIRAID] restore failed', err)), duration);
}

async function restoreRaidMode(guild, settings) {
  const restored = await externalApp.restore(guild, settings).catch(() => 0);
  await rateLimitManager.enqueue(() => guild.setVerificationLevel(0)).catch(() => {});
  raidActive.delete(guild.id);
  const alertChannel = settings.alertChannelId ? guild.channels.cache.get(settings.alertChannelId) : null;
  if (alertChannel?.isTextBased()) await alertChannel.send({ ...createMessage({title:'Raid Mode Deactivated',data:{Status:'Raid protection window ended','Channels Restored':String(restored)},color:COLORS.success}) }).catch(()=>{});
}
function isRaidActive(guildId){return raidActive.get(guildId) || false;}
module.exports={checkRaid,triggerRaidMode,restoreRaidMode,isRaidActive,joinCache,raidActive};
