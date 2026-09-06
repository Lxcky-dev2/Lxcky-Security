"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');
module.exports = {
  requiredPermission: 'muteMembers',
  data: new SlashCommandBuilder().setName('unvoicemute').setDescription('Remove a server mute')
    .addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),
  async execute(interaction){
    await interaction.deferReply({flags:64}); if(!(await hasPermission(interaction.member,'muteMembers'))) return interaction.editReply({content:'You do not have permission to unmute members.'});
    const user=interaction.options.getUser('user',true), reason=interaction.options.getString('reason')||'No reason provided'; const member=await interaction.guild.members.fetch(user.id).catch(()=>null); if(!member) return interaction.editReply({content:'User is not in this server.'}); if(!member.voice.channel) return interaction.editReply({content:'User is not in a voice channel.'}); if(!member.muteable) return interaction.editReply({content:'I cannot modify this member.'});
    await member.voice.setMute(false,reason); const caseId=await logAction(interaction.client,interaction.guildId,'unvoicemute',user.id,interaction.user.id,reason,{},'mod'); return interaction.editReply(createMessage({title:'Member Voice Unmuted',data:{User:`${user.tag} (${user.id})`,Moderator:interaction.user.tag,Reason:reason,'Case ID':`#${caseId}`},color:COLORS.success}));
  }
};
