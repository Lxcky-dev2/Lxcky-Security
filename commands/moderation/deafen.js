"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
module.exports = {
  requiredPermission: 'deafenMembers',
  data: new SlashCommandBuilder().setName('deafen').setDescription('Server deafen a member')
    .addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
  async execute(interaction){
    await interaction.deferReply({flags:64}); if(!(await hasPermission(interaction.member,'deafenMembers'))) return interaction.editReply({content:'You do not have permission to deafen members.'});
    const user=interaction.options.getUser('user',true), reason=interaction.options.getString('reason')||'No reason provided'; const member=await interaction.guild.members.fetch(user.id).catch(()=>null); if(!member) return interaction.editReply({content:'User is not in this server.'}); if(!member.voice.channel) return interaction.editReply({content:'User is not in a voice channel.'}); if(!member.deafable) return interaction.editReply({content:'I cannot deafen this member.'});
    await member.voice.setDeaf(true,reason); const caseId=await logAction(interaction.client,interaction.guildId,'deafen',user.id,interaction.user.id,reason,{},'mod'); return interaction.editReply(createMessage({title:'Member Deafened',data:{User:`${user.tag} (${user.id})`,Moderator:interaction.user.tag,Reason:reason,'Case ID':`#${caseId}`},color:COLORS.warning}));
  }
};
