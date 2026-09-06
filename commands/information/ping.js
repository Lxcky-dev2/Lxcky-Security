"use strict";

const { SlashCommandBuilder } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency'),

    async execute(interaction) {
        await interaction.reply({
            ...createMessage({
                title: 'Pong',
                data: {
                    'Latency': `${interaction.client.ws.ping}ms`,
                    'API Status': 'Online'
                },
                color: COLORS.default,
                ephemeral: true
            })
        });
    }
};