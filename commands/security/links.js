"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handle } = require('../../utils/linkFilter.js');
module.exports={requiredPermission:'manageGuild',data:new SlashCommandBuilder().setName('links').setDescription('Configure automatic link filtering').addSubcommand(s=>s.setName('panel').setDescription('Open the link filter panel')).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),async execute(i){return handle(i);}};
