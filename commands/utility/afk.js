"use strict";

const { SlashCommandBuilder } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { setAFK } = require('../../utils/afkManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set yourself as AFK')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for being AFK')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const reason = interaction.options.getString('reason') || 'No reason provided';
        const afk = await setAFK(interaction.user.id, interaction.guildId, reason);

        await interaction.editReply({
            ...createMessage({
                title: 'AFK Set',
                data: {
                    'Status': 'You are now AFK.',
                    'Reason': afk.reason,
                    'Set At': afk.setAt.toUTCString()
                },
                color: COLORS.default
            })
        });

        // Also notify in the channel (non-ephemeral) so others see it
        await interaction.channel.send({
            ...createMessage({
                title: `${interaction.user.username} is now AFK`,
                data: {
                    'Reason': afk.reason,
                    'Since': afk.setAt.toUTCString()
                },
                color: COLORS.warning
            })
        });
    }
};