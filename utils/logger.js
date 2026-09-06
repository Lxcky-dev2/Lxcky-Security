"use strict";

const { createMessage, COLORS } = require('./componentBuilder.js');
const GuildSettings = require('../db/models/GuildSettings.js');
const Log = require('../db/models/Log.js');

async function logToDatabase(guildId, action, targetUserId, moderatorId, reason, metadata = {}) {
    const caseId = `${action}_${Date.now()}_${targetUserId.slice(-4)}`;
    
    const log = new Log({
        guildId,
        caseId,
        action,
        targetUserId,
        moderatorId,
        reason: reason || 'No reason provided',
        metadata: metadata || {}
    });
    
    await log.save();
    return caseId;
}

async function logToChannel(client, guildId, channelType, title, data, color = COLORS.default, components = []) {
    const settings = await GuildSettings.findOne({ guildId });
    if (!settings) return;

    let channelId;
    if (!settings.loggingEnabled) return;
    switch (channelType) {
        case 'mod':
            channelId = settings.logChannelId;
            break;
        case 'alert':
            channelId = settings.alertChannelId;
            break;
        case 'member':
            channelId = settings.memberLogChannelId;
            break;
        case 'message':
            channelId = settings.messageLogChannelId;
            break;
        case 'verify':
            channelId = settings.verifyLogChannelId;
            break;
        case 'audit':
        case 'command':
            channelId = settings.commandLogChannelId || settings.auditLogChannelId || settings.logChannelId;
            break;
        case 'role':
            channelId = settings.roleLogChannelId || settings.auditLogChannelId || settings.logChannelId;
            break;
        case 'channel':
            channelId = settings.channelLogChannelId || settings.auditLogChannelId || settings.logChannelId;
            break;
        case 'voice':
            channelId = settings.voiceLogChannelId || settings.auditLogChannelId || settings.logChannelId;
            break;
        case 'security':
            channelId = settings.securityLogChannelId || settings.alertChannelId || settings.logChannelId;
            break;
        default:
            return;
    }

    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send({
                ...createMessage({
                    title,
                    data,
                    color,
                    components,
                    footer: `lxcky security - ${new Date().toUTCString()}`
                })
            });
        }
    } catch (error) {
        console.error(`[LOGGER] Failed to send log to channel ${channelId}:`, error.message);
    }
}

async function logAction(client, guildId, action, targetUserId, moderatorId, reason, metadata = {}, channelType = 'mod') {
    const caseId = await logToDatabase(guildId, action, targetUserId, moderatorId, reason, metadata);
    
    const data = {
        'Case ID': `#${caseId}`,
        'Action': action.charAt(0).toUpperCase() + action.slice(1),
        'Target': `<@${targetUserId}> (${targetUserId})`,
        'Moderator': `<@${moderatorId}>`,
        'Reason': reason || 'No reason provided'
    };

    if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
            data[key] = value;
        }
    }

    await logToChannel(client, guildId, channelType, `Action Log - ${action.toUpperCase()}`, data, COLORS.default);
    
    return caseId;
}

async function logAlert(client, guildId, title, data, color = COLORS.danger, components = []) {
    await logToChannel(client, guildId, 'alert', title, data, color, components);
}

async function logMember(client, guildId, title, data, color = COLORS.default) {
    await logToChannel(client, guildId, 'member', title, data, color);
}

async function logMessage(client, guildId, title, data, color = COLORS.default) {
    await logToChannel(client, guildId, 'message', title, data, color);
}

async function logVerify(client, guildId, title, data, color = COLORS.success) {
    await logToChannel(client, guildId, 'verify', title, data, color);
}

module.exports = {
    logToDatabase,
    logToChannel,
    logAction,
    logAlert,
    logMember,
    logMessage,
    logVerify
};