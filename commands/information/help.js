"use strict";

const { SlashCommandBuilder } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View all available commands'),

    async execute(interaction) {
        const commands = [];
        for (const cmd of interaction.client.commands.values()) {
            commands.push(`/${cmd.data.name} - ${cmd.data.description}`);
        }

        await interaction.reply({
            ...createMessage({
                title: 'lxcky Security - Command List',
                data: {
                    'Available Commands': commands.join('\n') || 'No commands loaded'
                },
                color: COLORS.default,
                ephemeral: true
            })
        });
    }
};