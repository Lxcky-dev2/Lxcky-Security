"use strict";
const { createMessage, createActionRow, createButton, COLORS } = require('./componentBuilder.js');
const GuildSettings = require('../db/models/GuildSettings.js');
const GlobalEntry = require('../db/models/GlobalEntry.js');
const rateLimitManager = require('./rateLimitManager.js');
const { createSecurityReport } = require('./centralReporting.js');

const suspiciousJoins = new Map();
const HIGH_PERMS = ['Administrator','ManageGuild','ManageChannels','ManageRoles','KickMembers','BanMembers','ManageWebhooks','ManageMessages'];

async function checkSuspiciousJoin(member) {
  const settings = await GuildSettings.findOne({ guildId: member.guild.id });
  if (!settings) return;
  const entry = await GlobalEntry.findOne({ discordId: member.user.id, active: true });
  if (settings.globalBlacklist && entry?.status === 'blacklisted') {
    await rateLimitManager.enqueue(() => member.ban({ reason: `Global blacklist: ${entry.reason}` })).catch(()=>{});
    const alert = settings.alertChannelId && member.guild.channels.cache.get(settings.alertChannelId);
    if (alert) await alert.send({ ...createMessage({ title:' Global Blacklist Trigger', data:{ User:`${member.user.tag} (${member.id})`, Reason:entry.reason, Action:'Banned automatically' }, color:COLORS.danger }) }).catch(()=>{});
    if (entry.type === 'bot' || member.user.bot) await createSecurityReport({kind:'blacklisted_bot',guildId:member.guild.id,guildName:member.guild.name,targetId:member.id,targetTag:member.user.tag,action:'AUTOMATIC BAN',reason:entry.reason});
    else await createSecurityReport({kind:'blacklisted_user',guildId:member.guild.id,guildName:member.guild.name,targetId:member.id,targetTag:member.user.tag,action:'AUTOMATIC BAN',reason:entry.reason});
    return;
  }
  if (!member.user.bot) return;
  const hasHighPerms = member.permissions.any(HIGH_PERMS);
  const suspicious = entry?.status === 'suspicious' || hasHighPerms;
  if (!suspicious) return;
  let role = settings.suspiciousRoleId ? member.guild.roles.cache.get(settings.suspiciousRoleId) : null;
  if (!role) { role = await member.guild.roles.create({name:'Suspicious',permissions:0n,reason:'lxcky Security suspicious bot'}).catch(()=>null); if(role){settings.suspiciousRoleId=role.id;await settings.save();} }
  if(role) await member.roles.add(role).catch(()=>{});
  suspiciousJoins.set(`${member.guild.id}:${member.id}`, { guildId:member.guild.id, memberId:member.id, joinedAt:Date.now() });
  const alert = settings.alertChannelId && member.guild.channels.cache.get(settings.alertChannelId);
  const row = createActionRow(createButton({label:'Investigate',customId:`investigate_${member.id}`,style:'secondary'}),createButton({label:'Ban',customId:`banuser_${member.id}`,style:'danger'}),createButton({label:'Ignore',customId:`approve_${member.id}`,style:'success'}));
  if(alert) await alert.send({ ...createMessage({ title:' Suspicious Bot Detected', data:{ Bot:`${member.user.tag} (${member.id})`, 'High Permissions':HIGH_PERMS.filter(p=>member.permissions.has(p)).join(', ')||'None', 'Database Status':entry?.status||'Not Found', Action:'Suspicious role assigned; moderator review required' }, color:COLORS.warning, components:[row] }) }).catch(()=>{});
  await createSecurityReport({kind:'suspicious_bot',guildId:member.guild.id,guildName:member.guild.name,targetId:member.id,targetTag:member.user.tag,action:'SUSPICIOUS JOIN',reason:entry?.reason||'Dangerous bot permissions detected',details:{permissions:HIGH_PERMS.filter(p=>member.permissions.has(p))}});
}
function clearSuspiciousEntry(userId, guildId=null) { if(guildId) suspiciousJoins.delete(`${guildId}:${userId}`); else for(const k of suspiciousJoins.keys()) if(k.endsWith(`:${userId}`)) suspiciousJoins.delete(k); }
function isSuspiciousJoin(guildId,userId){return suspiciousJoins.has(`${guildId}:${userId}`);}
module.exports={checkSuspiciousJoin,clearSuspiciousEntry,isSuspiciousJoin,suspiciousJoins,HIGH_PERMS};
