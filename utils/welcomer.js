"use strict";
const { ActionRowBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const WelcomeConfig = require('../db/models/WelcomeConfig.js');
const { hasPermission } = require('./permissionChecker.js');

async function getConfig(guildId) {
  let cfg = await WelcomeConfig.findOne({ guildId });
  if (!cfg) cfg = await WelcomeConfig.create({ guildId });
  return cfg;
}
function panel(cfg) {
  const embed = new EmbedBuilder().setTitle('Welcomer Configuration').setDescription([
    `Join channel: ${cfg.joinChannelId ? `<#${cfg.joinChannelId}>` : 'Not set'}`,
    `Leave channel: ${cfg.leaveChannelId ? `<#${cfg.leaveChannelId}>` : 'Not set'}`,
    `Join messages: ${cfg.joinEnabled ? 'Enabled' : 'Disabled'}`,
    `Leave messages: ${cfg.leaveEnabled ? 'Enabled' : 'Disabled'}`,
    '', 'Variables: {user}, {username}, {server}, {count}'
  ].join('\n'));
  const join = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('welcomer_join_channel').setPlaceholder('Select join channel').setChannelTypes(ChannelType.GuildText));
  const leave = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('welcomer_leave_channel').setPlaceholder('Select leave channel').setChannelTypes(ChannelType.GuildText));
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('welcomer_toggle_join').setLabel(cfg.joinEnabled ? 'Disable Join' : 'Enable Join').setStyle(cfg.joinEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('welcomer_toggle_leave').setLabel(cfg.leaveEnabled ? 'Disable Leave' : 'Enable Leave').setStyle(cfg.leaveEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('welcomer_edit_messages').setLabel('Edit Messages').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('welcomer_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
  );
  return { embeds:[embed], components:[join,leave,buttons], flags:MessageFlags.Ephemeral };
}
async function handle(interaction) {
  if (!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:MessageFlags.Ephemeral});
  return interaction.reply(panel(await getConfig(interaction.guildId)));
}
async function component(interaction){
  if (!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:MessageFlags.Ephemeral});
  const cfg=await getConfig(interaction.guildId), id=interaction.customId;
  if (id==='welcomer_join_channel') cfg.joinChannelId=interaction.values[0];
  else if (id==='welcomer_leave_channel') cfg.leaveChannelId=interaction.values[0];
  else if (id==='welcomer_toggle_join') cfg.joinEnabled=!cfg.joinEnabled;
  else if (id==='welcomer_toggle_leave') cfg.leaveEnabled=!cfg.leaveEnabled;
  else if (id==='welcomer_refresh') return interaction.update(panel(cfg));
  else if (id==='welcomer_edit_messages') {
    const modal=new ModalBuilder().setCustomId('welcomer_messages_modal').setTitle('Welcomer Messages');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('join').setLabel('Join message').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000).setValue(cfg.joinMessage || '')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('leave').setLabel('Leave message').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000).setValue(cfg.leaveMessage || ''))
    );
    return interaction.showModal(modal);
  } else return;
  await cfg.save(); return interaction.update(panel(cfg));
}
async function modal(interaction){
  if (!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:MessageFlags.Ephemeral});
  const cfg=await getConfig(interaction.guildId);
  cfg.joinMessage=interaction.fields.getTextInputValue('join') || cfg.joinMessage;
  cfg.leaveMessage=interaction.fields.getTextInputValue('leave') || cfg.leaveMessage;
  await cfg.save(); return interaction.reply(panel(cfg));
}
function renderTemplate(template, member) {
  return template.replace(/\{user\}/g, `<@${member.id}>`).replace(/\{username\}/g, member.user.username).replace(/\{server\}/g, member.guild.name).replace(/\{count\}/g, String(member.guild.memberCount));
}
async function handleMemberJoin(member){ const cfg=await getConfig(member.guild.id); if(!cfg.joinEnabled||!cfg.joinChannelId) return; const ch=member.guild.channels.cache.get(cfg.joinChannelId); if(ch?.isTextBased()) await ch.send({content:renderTemplate(cfg.joinMessage,member)}).catch(()=>{}); }
async function handleMemberLeave(member){ const cfg=await getConfig(member.guild.id); if(!cfg.leaveEnabled||!cfg.leaveChannelId) return; const ch=member.guild.channels.cache.get(cfg.leaveChannelId); if(ch?.isTextBased()) await ch.send({content:renderTemplate(cfg.leaveMessage,member)}).catch(()=>{}); }
module.exports={getConfig,panel,handle,component,modal,handleMemberJoin,handleMemberLeave};
