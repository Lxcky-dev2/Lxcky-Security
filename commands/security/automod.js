"use strict";
const {SlashCommandBuilder,PermissionFlagsBits}=require('discord.js');
const autoMod=require('../../utils/autoMod.js');
module.exports={requiredPermission:'manageGuild',data:new SlashCommandBuilder().setName('automod').setDescription('Configure AutoMod').addSubcommand(s=>s.setName('panel').setDescription('Open the AutoMod panel')).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),async execute(i){return autoMod.handle(i);}};
