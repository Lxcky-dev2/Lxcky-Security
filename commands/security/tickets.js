"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handleTicketCommand } = require('../../utils/ticketSystem.js');

module.exports = {
    requiredPermission: 'manageGuild',
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Configure and manage the ticket system')
        .addSubcommand(sub => sub.setName('setup').setDescription('Open the ticket setup panel'))
        .addSubcommand(sub => sub.setName('panel').setDescription('Post the configured ticket panel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        return handleTicketCommand(interaction);
    }
};
