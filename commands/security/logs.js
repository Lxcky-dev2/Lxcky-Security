"use strict";
const {SlashCommandBuilder,PermissionFlagsBits}=require('discord.js');
const logs=require('../../utils/logsPanel.js');
module.exports={requiredPermission:'manageGuild',data:new SlashCommandBuilder().setName('logs').setDescription('Configure server logging').addSubcommand(s=>s.setName('panel').setDescription('Open the logging panel')).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),async execute(i){return logs.handle(i);}};
