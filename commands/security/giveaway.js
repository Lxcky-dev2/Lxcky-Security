"use strict";
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Giveaway = require('../../db/models/Giveaway.js');
const { hasPermission } = require('../../utils/permissionChecker.js');
const { logAction } = require('../../utils/logger.js');

function durationMs(input){ const m=String(input).match(/^(\d+)(s|m|h|d|w)$/i); if(!m)return null; const n=Number(m[1]); const mult={s:1000,m:60000,h:3600000,d:86400000,w:604800000}[m[2].toLowerCase()]; return n>0?n*mult:null; }
function giveawayMessage(g){
  const embed=new EmbedBuilder().setTitle(g.prize).setDescription(`${g.description}\n\nEnds: <t:${Math.floor(g.endAt.getTime()/1000)}:R>\nWinners: ${g.winners}\nEntries: ${g.participants.length}`).setColor(0x5865F2).setFooter({text:`Giveaway ID: ${g._id}`});
  return {embeds:[embed],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway_enter_${g._id}`).setLabel('Enter Giveaway').setStyle(ButtonStyle.Primary))]};
}
async function execute(interaction){
  await interaction.deferReply({flags:64});
  if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.editReply({content:'Manage Server permission is required.'});
  const sub=interaction.options.getSubcommand();
  if(sub==='panel') return interaction.editReply({embeds:[new EmbedBuilder().setTitle('Giveaway Management').setDescription('Use Create to start a giveaway, List to view active giveaways, End to finish one, or Reroll to choose new winners.')],components:[new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_create').setLabel('Create').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('giveaway_list').setLabel('Active Giveaways').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('giveaway_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
  )]});
  if(sub==='create') return interaction.editReply({content:'Use `/giveaway create` with the required options. The command is ready for use.'});
  if(sub==='end'||sub==='reroll') return finish(interaction,interaction.options.getString('id',true),sub==='reroll');
  if(sub==='list') { const rows=await Giveaway.find({guildId:interaction.guildId,ended:false}).sort({endAt:1}).limit(20); return interaction.editReply({embeds:[new EmbedBuilder().setTitle('Active Giveaways').setDescription(rows.length?rows.map(g=>`${g._id} | ${g.prize} | <#${g.channelId}> | <t:${Math.floor(g.endAt.getTime()/1000)}:R>`).join('\n'):'No active giveaways.')]}); }
  return interaction.editReply({content:'Unknown giveaway action.'});
}
async function create(interaction){
  await interaction.deferReply({flags:64}); if(!(await hasPermission(interaction.member,'manageGuild'))) return interaction.editReply({content:'Manage Server permission is required.'});
  const channel=interaction.options.getChannel('channel',true); const prize=interaction.options.getString('prize',true); const duration=durationMs(interaction.options.getString('duration',true)); const winners=interaction.options.getInteger('winners',true); const description=interaction.options.getString('description')||'Enter the giveaway below.';
  if(!channel.isTextBased()) return interaction.editReply({content:'The giveaway channel must be a text channel.'}); if(!duration) return interaction.editReply({content:'Duration must look like 30m, 2h, 7d, or 1w.'});
  const g=await Giveaway.create({guildId:interaction.guildId,channelId:channel.id,hostId:interaction.user.id,prize,description,winners,endAt:new Date(Date.now()+duration)});
  const msg=await channel.send(giveawayMessage(g)); g.messageId=msg.id; await g.save(); await logAction(interaction.client,interaction.guildId,'giveaway_create',g._id.toString(),interaction.user.id,prize,{channelId:channel.id,winners,durationMs:duration},'mod');
  return interaction.editReply({content:`Giveaway created in <#${channel.id}>.`});
}
async function finish(interaction,id,reroll=false){
  const g=await Giveaway.findOne({_id:id,guildId:interaction.guildId}); if(!g)return interaction.editReply({content:'Giveaway not found.'}); if(!g.ended&&!reroll){g.ended=true;g.endedAt=new Date();}
  if(reroll && !g.ended) return interaction.editReply({content:'End the giveaway before rerolling.'});
  const pool=[...g.participants]; const winners=[]; while(winners.length<Math.min(g.winners,pool.length)){ winners.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]); }
  if(!reroll){g.winnerIds=winners;await g.save();} else {g.winnerIds=winners;await g.save();}
  const channel=interaction.guild.channels.cache.get(g.channelId); if(channel?.isTextBased()&&g.messageId){const msg=await channel.messages.fetch(g.messageId).catch(()=>null); if(msg) await msg.edit({...giveawayMessage(g),components:[]}).catch(()=>{}); await channel.send({content:`Giveaway ended for ${g.prize}. Winners: ${winners.length?winners.map(id=>`<@${id}>`).join(', '):'No eligible winners.'}`}).catch(()=>{});}
  return interaction.editReply({content:`Giveaway ${reroll?'rerolled':'ended'}. ${winners.length} winner(s) selected.`});
}
async function handleComponent(interaction){
  const id=interaction.customId;
  if(id==='giveaway_refresh'||id==='giveaway_list'||id==='giveaway_create') return interaction.reply({content:'Use the giveaway command to manage giveaways.',flags:64});
  if(!id.startsWith('giveaway_enter_')) return;
  const gid=id.slice('giveaway_enter_'.length); const g=await Giveaway.findOne({_id:gid,guildId:interaction.guildId,ended:false}); if(!g)return interaction.reply({content:'This giveaway is no longer active.',flags:64});
  if(g.endAt.getTime()<=Date.now()) return interaction.reply({content:'This giveaway has ended.',flags:64});
  const idx=g.participants.indexOf(interaction.user.id); if(idx>=0){g.participants.splice(idx,1); await g.save(); return interaction.reply({content:'You have left the giveaway.',flags:64});}
  g.participants.push(interaction.user.id); await g.save();
  const channel=interaction.guild.channels.cache.get(g.channelId); const msg=channel?.messages.cache.get(g.messageId); if(msg) await msg.edit(giveawayMessage(g)).catch(()=>{});
  return interaction.reply({content:'You entered the giveaway.',flags:64});
}
async function processDueGiveaways(client){
  const due=await Giveaway.find({ended:false,endAt:{$lte:new Date()}}).limit(50);
  for(const g of due){
    try{
      g.ended=true; g.endedAt=new Date();
      const pool=[...g.participants], winners=[];
      while(winners.length<Math.min(g.winners,pool.length)){ winners.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]); }
      g.winnerIds=winners; await g.save();
      const channel=client.channels.cache.get(g.channelId);
      if(channel?.isTextBased()){
        const msg=g.messageId?await channel.messages.fetch(g.messageId).catch(()=>null):null;
        if(msg) await msg.edit({...giveawayMessage(g),components:[]}).catch(()=>{});
        await channel.send({content:`Giveaway ended for ${g.prize}. Winners: ${winners.length?winners.map(id=>`<@${id}>`).join(', '):'No eligible winners.'}`}).catch(()=>{});
      }
    }catch(error){ console.error('[GIVEAWAY] Failed to finish giveaway:',error); }
  }
}

function command(){ return new SlashCommandBuilder().setName('giveaway').setDescription('Create and manage giveaways').addSubcommand(s=>s.setName('create').setDescription('Create a giveaway').addChannelOption(o=>o.setName('channel').setDescription('Giveaway channel').setRequired(true)).addStringOption(o=>o.setName('prize').setDescription('Prize').setRequired(true).setMaxLength(200)).addStringOption(o=>o.setName('duration').setDescription('Duration such as 30m, 2h, 7d').setRequired(true)).addIntegerOption(o=>o.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(50)).addStringOption(o=>o.setName('description').setDescription('Description').setRequired(false).setMaxLength(1000))).addSubcommand(s=>s.setName('panel').setDescription('Open giveaway management panel')).addSubcommand(s=>s.setName('list').setDescription('List active giveaways')).addSubcommand(s=>s.setName('end').setDescription('End a giveaway').addStringOption(o=>o.setName('id').setDescription('Giveaway ID').setRequired(true))).addSubcommand(s=>s.setName('reroll').setDescription('Reroll a finished giveaway').addStringOption(o=>o.setName('id').setDescription('Giveaway ID').setRequired(true))).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild); }
module.exports={data:command(),requiredPermission:'manageGuild',async execute(i){if(i.options.getSubcommand()==='create')return create(i); return execute(i);},handleComponent,processDueGiveaways};
