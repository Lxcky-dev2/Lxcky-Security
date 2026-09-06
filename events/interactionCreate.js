"use strict";

const { handleComponentInteraction } = require('../handlers/componentHandler.js');

module.exports = {
    async execute(interaction, client) {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`[ERROR] Executing ${interaction.commandName}:`, error);
                const errorReply = {
                    content: 'An error occurred while executing this command.',
                    flags: MessageFlags.Ephemeral,
                };
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorReply).catch(() => {});
                } else {
                    await interaction.reply(errorReply).catch(() => {});
                }
            }
            return;
        }

        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isModalSubmit()) {
            await handleComponentInteraction(interaction);
        }
    }
};