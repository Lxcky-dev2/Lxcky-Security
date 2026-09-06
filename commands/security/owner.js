"use strict";
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { ownerPanel, } = require('../../utils/ownerPanel.js');
const { isOwner, getOwnerConfig } = require('../../utils/ownerConfig.js');
module.exports={data:new SlashCommandBuilder().setName('owner').setDescription('Open the private owner control panel'),async execute(interaction){if(!isOwner(interaction.user.id)) return interaction.reply({content:'This command is owner-only.',flags:MessageFlags.Ephemeral}); await interaction.deferReply({flags:MessageFlags.Ephemeral}); try{return interaction.editReply(ownerPanel(await getOwnerConfig(),interaction.client));}catch(error){console.error('[OWNER] Panel failed:',error);return interaction.editReply({content:'Failed to load the owner panel.'});}}};
