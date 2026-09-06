"use strict";
const {SlashCommandBuilder,PermissionFlagsBits}=require('discord.js');
const whitelist=require('../../utils/whitelist.js');
module.exports={requiredPermission:'manageGuild',data:new SlashCommandBuilder().setName('whitelist').setDescription('Configure security whitelist').addSubcommand(s=>s.setName('panel').setDescription('Open whitelist panel')).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),async execute(i){return whitelist.handle(i);}};
