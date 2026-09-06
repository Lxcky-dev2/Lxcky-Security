"use strict";
const { createMessage, createActionRow, createButton, COLORS } = require('./componentBuilder.js');
const GuildSettings = require('../db/models/GuildSettings.js');
const GlobalEntry = require('../db/models/GlobalEntry.js');
const rateLimitManager = require('./rateLimitManager.js');
const { clearSuspiciousEntry } = require('./securityChecks.js');
const { createSecurityReport } = require('./centralReporting.js');
const { hasPermission } = require('./permissionChecker.js');

async function handleApprovalFlow(interaction) {
  const [action,userId] = interaction.customId.split('_');
  if(!userId) return interaction.reply({content:'Invalid security action.',ephemeral:true});
  const settings=await GuildSettings.findOne({guildId:interaction.guildId});
  const member=await interaction.guild.members.fetch(userId).catch(()=>null);
  if(!settings||!member) return interaction.reply({content:'User is no longer available.',ephemeral:true});
  if(!(await hasPermission(interaction.member,'mod'))) return interaction.reply({content:'You do not have the required moderation permission.',ephemeral:true});
  if(action==='approve'){
    const role=settings.suspiciousRoleId&&interaction.guild.roles.cache.get(settings.suspiciousRoleId); if(role) await member.roles.remove(role).catch(()=>{}); clearSuspiciousEntry(userId,interaction.guildId);
    return interaction.update(createMessage({title:' Suspicious Bot Dismissed',data:{Bot:`${member.user.tag} (${userId})`,Moderator:interaction.user.tag,Status:'Approved / ignored for this incident'},color:COLORS.success}));
  }
  if(action==='banuser'){
    if(!(await hasPermission(interaction.member,'banMembers'))) return interaction.reply({content:'Ban Members permission is required for this action.',ephemeral:true});
    const reason=`Suspicious bot banned by ${interaction.user.tag}`;
    await rateLimitManager.enqueue(()=>member.ban({reason})); clearSuspiciousEntry(userId,interaction.guildId);
    await createSecurityReport({kind:'suspicious_bot',guildId:interaction.guildId,guildName:interaction.guild.name,targetId:userId,targetTag:member.user.tag,actorId:interaction.user.id,actorTag:interaction.user.tag,action:'BANNED BY SERVER STAFF',reason});
    return interaction.update(createMessage({title:' Suspicious Bot Banned',data:{Bot:`${member.user.tag} (${userId})`,BannedBy:interaction.user.tag,CentralReport:'Sent to the configured security report channel'},color:COLORS.danger}));
  }
  if(action==='investigate'){
    return interaction.update(createMessage({title:' Bot Investigation',data:{Bot:`${member.user.tag} (${userId})`,'Account Created':member.user.createdAt.toUTCString(),'Permissions':member.permissions.toArray().join(', ')||'None','Roles':member.roles.cache.map(r=>r.name).join(', ')||'None'},color:COLORS.warning,components:[createActionRow(createButton({label:'Ban',customId:`banuser_${userId}`,style:'danger'}),createButton({label:'Dismiss',customId:`approve_${userId}`,style:'success'}))]}));
  }
}
module.exports={handleApprovalFlow};
