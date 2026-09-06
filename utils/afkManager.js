"use strict";

const AFK = require('../db/models/AFK.js');
const { createMessage, COLORS } = require('./componentBuilder.js');

/**
 * Set a user as AFK
 */
async function setAFK(userId, guildId, reason) {
    // Remove any existing AFK first (to avoid duplicate key errors)
    await AFK.findOneAndDelete({ userId, guildId });
    const afk = new AFK({ userId, guildId, reason: reason || 'No reason provided' });
    await afk.save();
    return afk;
}

/**
 * Get AFK status for a user
 */
async function getAFK(userId, guildId) {
    return await AFK.findOne({ userId, guildId });
}

/**
 * Remove AFK status for a user (returns the removed entry or null)
 */
async function removeAFK(userId, guildId) {
    const removed = await AFK.findOneAndDelete({ userId, guildId });
    return removed;
}

/**
 * Handle AFK logic on message creation:
 * - If the author is AFK, remove it and send a notification.
 * - If any mention targets an AFK user, reply with their status.
 */
async function handleAFKOnMessage(message, client) {
    if (!message.guild) return; // DM messages not handled
    if (message.author.bot) return;

    const guildId = message.guild.id;
    const authorId = message.author.id;

    // 1. Check if the author is AFK
    const authorAFK = await getAFK(authorId, guildId);
    if (authorAFK) {
        await removeAFK(authorId, guildId);
        // Send a notification in the channel using an embed
        await message.reply({
            ...createMessage({
                title: 'AFK Removed',
                data: {
                    'Status': 'Your AFK status has been removed.',
                    'Reason': authorAFK.reason,
                    'Set At': authorAFK.setAt.toUTCString()
                },
                color: COLORS.success
            })
        });
        // Also delete the AFK message if the user wants? Not needed.
    }

    // 2. Check mentions for AFK users
    const mentionedUsers = message.mentions.users;
    if (mentionedUsers.size > 0) {
        for (const [mentionId, user] of mentionedUsers) {
            if (mentionId === authorId) continue; // Don't self-mention
            const afk = await getAFK(mentionId, guildId);
            if (afk) {
                // Send a reply for the first AFK mention (to avoid spam)
                await message.reply({
                    ...createMessage({
                        title: 'User is AFK',
                        data: {
                            'User': `${user.tag} (${mentionId})`,
                            'Reason': afk.reason,
                            'Since': afk.setAt.toUTCString()
                        },
                        color: COLORS.warning
                    })
                });
                break; // Only send one AFK mention per message
            }
        }
    }
}

module.exports = {
    setAFK,
    getAFK,
    removeAFK,
    handleAFKOnMessage
};