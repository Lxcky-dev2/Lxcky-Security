"use strict";

const { createMessage, COLORS } = require('./componentBuilder.js');
const GuildSettings = require('../db/models/GuildSettings.js');
const Account = require('../db/models/Account.js');
const rateLimitManager = require('./rateLimitManager.js');

const messageCache = new Map();

async function checkSpam(message) {
    const settings = await GuildSettings.findOne({ guildId: message.guild.id });
    if (!settings || !settings.spamFilter) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const cacheKey = `${guildId}_${userId}`;

    if (!messageCache.has(cacheKey)) {
        messageCache.set(cacheKey, []);
    }

    const userMessages = messageCache.get(cacheKey);
    const now = Date.now();

    // Clean old messages (older than 10 seconds)
    const filtered = userMessages.filter(timestamp => now - timestamp < 10000);
    filtered.push(now);
    messageCache.set(cacheKey, filtered);

    // Check for duplicate messages
    const recentMessages = [];
    const messages = await message.channel.messages.fetch({ limit: 10 }).catch(() => []);
    let duplicateCount = 0;
    
    for (const msg of messages.values()) {
        if (msg.author.id === userId && msg.content === message.content) {
            duplicateCount++;
        }
    }

    // Check for mass mentions
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    const hasMassMention = mentionCount >= 5;

    // Check for message flooding
    const messageCount = filtered.length;
    const isFlooding = messageCount >= (settings.spamThreshold || 5);

    if (duplicateCount >= 3 || hasMassMention || isFlooding) {
        // Delete the spam message
        await message.delete().catch(() => {});

        // Get or create account
        let account = await Account.findOne({ dcId: userId, guildId });
        if (!account) {
            account = new Account({ dcId: userId, guildId });
            await account.save();
        }

        // Check if user already has active timeout
        if (account.activeTimeout && account.activeTimeout.until > new Date()) {
            // Extend timeout
            const currentUntil = new Date(account.activeTimeout.until);
            const extendedUntil = new Date(currentUntil.getTime() + (settings.muteDuration || 10) * 60 * 1000);
            account.activeTimeout.until = extendedUntil;
            await account.save();

            // Update timeout in Discord
            const member = await message.guild.members.fetch(userId).catch(() => null);
            if (member) {
                await rateLimitManager.enqueue(async () => {
                    await member.timeout(extendedUntil, 'Extended timeout for spam');
                });
            }

            const alertChannel = message.guild.channels.cache.get(settings.alertChannelId);
            if (alertChannel) {
                await alertChannel.send({
                    ...createMessage({
                        title: 'Spam Filter - Timeout Extended',
                        data: {
                            'User': `${message.author.tag} (${userId})`,
                            'Action': 'Timeout extended',
                            'Duration': `${settings.muteDuration} minutes`,
                            'New Expiry': extendedUntil.toUTCString()
                        },
                        color: COLORS.warning
                    })
                });
            }
            return;
        }

        // Apply timeout
        const timeoutDuration = (settings.muteDuration || 10) * 60 * 1000;
        const timeoutUntil = new Date(now + timeoutDuration);

        account.activeTimeout = {
            until: timeoutUntil,
            reason: 'Spam filter triggered',
            moderatorId: 'lxcky security auto-mod'
        };
        await account.save();

        // Add warning
        account.warnings.push({
            reason: 'Spam filter triggered (flooding, duplicates, or mass mentions)',
            moderatorId: 'lxcky security auto-mod',
            caseId: `spam_${Date.now()}_${userId.slice(-4)}`
        });
        await account.save();

        // Apply timeout in Discord
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member) {
            await rateLimitManager.enqueue(async () => {
                await member.timeout(timeoutUntil, 'Spam filter triggered');
            });
        }

        // Send alert to mod channel
        const alertChannel = message.guild.channels.cache.get(settings.alertChannelId);
        if (alertChannel) {
            const reasons = [];
            if (duplicateCount >= 3) reasons.push(`Duplicates: ${duplicateCount} identical messages`);
            if (hasMassMention) reasons.push(`Mass mentions: ${mentionCount} mentions`);
            if (isFlooding) reasons.push(`Flooding: ${messageCount} messages in 10 seconds`);

            await alertChannel.send({
                ...createMessage({
                    title: 'Spam Filter - Action Taken',
                    data: {
                        'User': `${message.author.tag} (${userId})`,
                        'Action': 'Timeout applied',
                        'Duration': `${settings.muteDuration} minutes`,
                        'Reason': reasons.join(' | '),
                        'Warning Count': account.warnings.length
                    },
                    color: COLORS.warning
                })
            });
        }

        // Warn the user
        await message.author.send({
            ...createMessage({
                title: 'lxcky Security - Spam Warning',
                data: {
                    'Server': message.guild.name,
                    'Action': 'Timeout applied',
                    'Duration': `${settings.muteDuration} minutes`,
                    'Reason': reasons.join(' | ')
                },
                color: COLORS.warning
            })
        }).catch(() => {});
    }
}

// Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of messageCache) {
        const filtered = timestamps.filter(t => now - t < 10000);
        if (filtered.length === 0) {
            messageCache.delete(key);
        } else {
            messageCache.set(key, filtered);
        }
    }
}, 30000);

module.exports = {
    checkSpam,
    messageCache
};