"use strict";

const { createMessage, COLORS } = require('../utils/componentBuilder.js');
const { MessageFlags } = require('discord.js');
const { autoDeferComponent } = require('../utils/interactionResponder.js');

// Store all registered handlers
const componentHandlers = new Map();

/**
 * Register a handler function for a specific customId prefix.
 * @param {string} prefix - The customId prefix (e.g., 'panel_', 'toggle_')
 * @param {Function} handler - Async function(interaction) => void
 */
function registerComponentHandler(prefix, handler) {
    if (typeof prefix !== 'string' || typeof handler !== 'function') {
        throw new Error('Invalid handler registration: prefix must be string, handler must be function');
    }
    componentHandlers.set(prefix, handler);
    console.log(`[HANDLER] Registered component handler for prefix: ${prefix}`);
}

/**
 * Route an interaction to the appropriate handler.
 * @param {Interaction} interaction - The Discord interaction
 */
async function handleComponentInteraction(interaction) {
    const customId = interaction.customId;

    if (!customId) {
        console.warn('[WARN] Interaction has no customId:', interaction);
        return;
    }

    // Find the first matching prefix
    for (const [prefix, handler] of componentHandlers) {
        if (customId.startsWith(prefix)) {
            try {
                await autoDeferComponent(interaction);
                await handler(interaction);
                return;
            } catch (error) {
                console.error(`[ERROR] Handler for ${prefix}:`, error);
                const errorPayload = createMessage({
                    title: 'Something Went Wrong',
                    data: { Message: 'An error occurred while processing this action.' },
                    color: COLORS.danger,
                    flags: MessageFlags.Ephemeral
                });
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorPayload).catch(() => {});
                } else {
                    await interaction.reply(errorPayload).catch(() => {});
                }
                return;
            }
        }
    }

    // No handler found
    console.warn(`[WARN] No handler registered for interaction: ${customId}`);
    if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
            ...createMessage({
                title: 'Unhandled Component',
                data: { Message: 'This component is not handled.' },
                color: COLORS.warning,
                flags: MessageFlags.Ephemeral
            })
        }).catch(() => {});
    }
}

module.exports = {
    registerComponentHandler,
    handleComponentInteraction,
    componentHandlers
};