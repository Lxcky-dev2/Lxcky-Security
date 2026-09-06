"use strict";
const { ActionRowBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const LinkRule = require('../db/models/LinkRule.js');
const { hasPermission } = require('./permissionChecker.js');
const { logMessage } = require('./logger.js');

const URL_PATTERN = /https?:\/\/[^\s<]+|www\.[^\s<]+/i;

async function listRules(guildId){ return LinkRule.find({guildId}).sort({createdAt:1}); }
function panel(rules){
  const lines = rules.length ? rules.map((r,i)=>`${i+1}. ${r.name} | ${r.isRegex?'Regex':'Text'} | ${r.enabled?'Enabled':'Disabled'} | Bypass roles: ${r.bypassRoleIds.length}`).join('\n') : 'No link rules configured.';
  const embed=new EmbedBuilder().setTitle('Link Filter Configuration').setDescription(`${lines}\n\nAdd a rule, select one to configure, or set bypass roles.\nLink rules are checked on every new message.`);
  const rows=[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('links_add').setLabel('Add Rule').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('links_select').setLabel('Select Rule').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('links_delete').setLabel('Delete Rule').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('links_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary))];
  return {embeds:[embed],components:rows,flags:MessageFlags.Ephemeral};
}
function ruleOptions(rules){ return rules.slice(0,25).map(r=>({label:r.name.slice(0,100),value:r.id,description:`${r.isRegex?'Regex':'Text'} | ${r.enabled?'Enabled':'Disabled'}`})); }
async function handle(interaction){
  if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:64});
  return interaction.reply(panel(await listRules(interaction.guildId)));
}
async function component(interaction){
  if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:64});
  const id=interaction.customId;
  if(id==='links_refresh') return interaction.update(panel(await listRules(interaction.guildId)));
  if(id==='links_add'){
    const modal=new ModalBuilder().setCustomId('links_add_modal').setTitle('Add Link Rule');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Rule name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pattern').setLabel('Text or regex pattern').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('regex').setLabel('Regex? Enter yes or no').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)));
    return interaction.showModal(modal);
  }
  const rules=await listRules(interaction.guildId);
  if(id==='links_select'){
    const {StringSelectMenuBuilder}=require('discord.js');
    if(!rules.length) return interaction.reply({content:'No rules exist yet.',flags:64});
    const menu=new StringSelectMenuBuilder().setCustomId('links_choose_rule').setPlaceholder('Select a rule').addOptions(ruleOptions(rules));
    return interaction.update({embeds:[new EmbedBuilder().setTitle('Select Link Rule').setDescription('Select a rule to configure.')],components:[new ActionRowBuilder().addComponents(menu),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('links_refresh').setLabel('Back').setStyle(ButtonStyle.Secondary))],flags:64});
  }
  if(id==='links_delete'){
    const {StringSelectMenuBuilder}=require('discord.js'); if(!rules.length)return interaction.reply({content:'No rules exist yet.',flags:64});
    const menu=new StringSelectMenuBuilder().setCustomId('links_delete_rule').setPlaceholder('Select a rule to delete').addOptions(ruleOptions(rules));
    return interaction.update({embeds:[new EmbedBuilder().setTitle('Delete Link Rule').setDescription('Select a rule to delete.')],components:[new ActionRowBuilder().addComponents(menu),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('links_refresh').setLabel('Back').setStyle(ButtonStyle.Secondary))],flags:64});
  }
  if(id==='links_toggle_rule_') return;
}
async function select(interaction){
  if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:64});
  const id=interaction.customId;
  if(id==='links_delete_rule'){ const r=await LinkRule.findOneAndDelete({_id:interaction.values[0],guildId:interaction.guildId}); return interaction.update(panel(await listRules(interaction.guildId))); }
  if(id==='links_choose_rule'){
    const r=await LinkRule.findOne({_id:interaction.values[0],guildId:interaction.guildId}); if(!r)return interaction.reply({content:'Rule not found.',flags:64});
    return interaction.update({embeds:[new EmbedBuilder().setTitle(`Link Rule: ${r.name}`).setDescription(`Pattern: ${r.pattern}\nType: ${r.isRegex?'Regex':'Text'}\nStatus: ${r.enabled?'Enabled':'Disabled'}\nBypass roles: ${r.bypassRoleIds.map(x=>`<@&${x}>`).join(', ')||'None'}`)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`links_toggle_${r.id}`).setLabel(r.enabled?'Disable':'Enable').setStyle(r.enabled?ButtonStyle.Danger:ButtonStyle.Success),new ButtonBuilder().setCustomId(`links_bypass_${r.id}`).setLabel('Set Bypass Roles').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('links_refresh').setLabel('Back').setStyle(ButtonStyle.Secondary))],flags:64});
  }
}
async function specificButton(interaction){
  if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:64});
  const id=interaction.customId;
  if(id.startsWith('links_toggle_')){const rid=id.slice('links_toggle_'.length);const r=await LinkRule.findOne({_id:rid,guildId:interaction.guildId});if(!r)return interaction.reply({content:'Rule not found.',flags:64});r.enabled=!r.enabled;await r.save();return interaction.update({embeds:[new EmbedBuilder().setTitle(`Link Rule: ${r.name}`).setDescription(`Pattern: ${r.pattern}\nType: ${r.isRegex?'Regex':'Text'}\nStatus: ${r.enabled?'Enabled':'Disabled'}\nBypass roles: ${r.bypassRoleIds.map(x=>`<@&${x}>`).join(', ')||'None'}`)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`links_toggle_${r.id}`).setLabel(r.enabled?'Disable':'Enable').setStyle(r.enabled?ButtonStyle.Danger:ButtonStyle.Success),new ButtonBuilder().setCustomId(`links_bypass_${r.id}`).setLabel('Set Bypass Roles').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('links_refresh').setLabel('Back').setStyle(ButtonStyle.Secondary))],flags:64});}
  if(id.startsWith('links_bypass_')){const rid=id.slice('links_bypass_'.length);const menu=new RoleSelectMenuBuilder().setCustomId(`links_roles_${rid}`).setPlaceholder('Select bypass roles').setMinValues(0).setMaxValues(10);return interaction.update({embeds:[new EmbedBuilder().setTitle('Link Filter Bypass Roles').setDescription('Select all roles allowed to bypass this rule.')],components:[new ActionRowBuilder().addComponents(menu),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('links_refresh').setLabel('Back').setStyle(ButtonStyle.Secondary))],flags:64});}
}
async function modal(interaction){
  if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:64});
  const name=interaction.fields.getTextInputValue('name').trim(), pattern=interaction.fields.getTextInputValue('pattern').trim(), raw=interaction.fields.getTextInputValue('regex').trim().toLowerCase(); const isRegex=raw==='yes'||raw==='true';
  if(!name||!pattern)return interaction.reply({content:'Name and pattern are required.',flags:64});
  if(isRegex){try{new RegExp(pattern);}catch(e){return interaction.reply({content:'That regex is invalid.',flags:64});}}
  await LinkRule.create({guildId:interaction.guildId,name,pattern,isRegex,enabled:true,bypassRoleIds:[]}); return interaction.reply(panel(await listRules(interaction.guildId)));
}
async function roles(interaction){
  if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:64});
  const rid=interaction.customId.slice('links_roles_'.length);const r=await LinkRule.findOne({_id:rid,guildId:interaction.guildId}); if(!r)return interaction.reply({content:'Rule not found.',flags:64}); r.bypassRoleIds=interaction.values||[]; await r.save(); return interaction.reply({content:'Bypass roles updated.',flags:64});
}
function matchesRule(message,r){ if(!r.enabled)return false; if(r.isRegex){try{return new RegExp(r.pattern,'i').test(message.content);}catch{return false;}} return message.content.toLowerCase().includes(r.pattern.toLowerCase()); }
async function checkMessage(message){ if(!message.guild||message.author.bot||!message.content)return; const rules=await LinkRule.find({guildId:message.guild.id,enabled:true}); if(!rules.length)return; const bypass=message.member?.roles?.cache; for(const r of rules){ if(bypass && r.bypassRoleIds.some(id=>bypass.has(id))) continue; if(!matchesRule(message,r)) continue; await message.delete().catch(()=>{}); await logMessage(global.client,message.guild.id,'Link Filter - Message Deleted',{User:`${message.author.tag} (${message.author.id})`,Channel:`<#${message.channel.id}>`,Rule:r.name,Pattern:r.pattern},0xED4245); break; } }
module.exports={handle,component,select,specificButton,modal,roles,checkMessage,panel};
