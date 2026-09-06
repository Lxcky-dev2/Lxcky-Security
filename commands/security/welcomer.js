"use strict";
const welcomer = require('../../utils/welcomer.js');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  requiredPermission:'manageGuild',
  data:new SlashCommandBuilder().setName('welcomer').setDescription('Configure welcome and leave messages')
    .addSubcommand(s=>s.setName('panel').setDescription('Open the welcomer configuration panel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(i){ await welcomer.handle(i); }
};
