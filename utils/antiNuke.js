"use strict";

const { AuditLogEvent } = require('discord.js');
const GuildSettings = require('../db/models/GuildSettings.js');
const { logAlert } = require('./logger.js');
const { isWhitelisted } = require('./whitelist.js');
const { getLatestBackup, restoreBackup } = require('./backupManager.js');
const rateLimitManager = require('./rateLimitManager.js');

const activity = new Map();
const recoveringGuilds = new Set();

const ACTIONS = new Set([
    AuditLogEvent.ChannelDelete,
    AuditLogEvent.ChannelCreate,
    AuditLogEvent.RoleDelete,
    AuditLogEvent.RoleCreate,
    AuditLogEvent.BanAdd,
    AuditLogEvent.BanRemove,
    AuditLogEvent.KickMember,
    AuditLogEvent.WebhookCreate,
    AuditLogEvent.WebhookDelete,
    AuditLogEvent.WebhookUpdate,
]);

const ACTION_NAMES = new Map([
    [AuditLogEvent.ChannelDelete, 'Channel Delete'],
    [AuditLogEvent.ChannelCreate, 'Channel Create'],
    [AuditLogEvent.RoleDelete, 'Role Delete'],
    [AuditLogEvent.RoleCreate, 'Role Create'],
    [AuditLogEvent.BanAdd, 'Ban Add'],
    [AuditLogEvent.BanRemove, 'Ban Remove'],
    [AuditLogEvent.KickMember, 'Kick Member'],
    [AuditLogEvent.WebhookCreate, 'Webhook Create'],
    [AuditLogEvent.WebhookDelete, 'Webhook Delete'],
    [AuditLogEvent.WebhookUpdate, 'Webhook Update'],
]);

function recordKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

async function contain(guild, executorId, settings, actionCount, actionName) {
    const member = await guild.members.fetch(executorId).catch(() => null);
    const executorMention = `<@${executorId}> (${executorId})`;
    let punishmentResult = 'No punishment taken';

    if (member && !member.user.bot && !member.bannable && !member.kickable) {
        punishmentResult = 'Executor could not be punished due to role hierarchy';
    } else if (member && settings.antiNukePunishment === 'kick' && member.kickable) {
        await member.kick('lxcky Security anti-nuke: mass destructive activity').then(() => {
            punishmentResult = 'Executor kicked';
        }).catch(() => {
            punishmentResult = 'Kick failed';
        });
    } else if (member && settings.antiNukePunishment !== 'none' && member.bannable) {
        await member.ban({ deleteMessageSeconds: 0, reason: 'lxcky Security anti-nuke: mass destructive activity' }).then(() => {
            punishmentResult = 'Executor banned';
        }).catch(() => {
            punishmentResult = 'Ban failed';
        });
    } else if (member) {
        punishmentResult = 'Executor was not punishable by the bot hierarchy';
    } else {
        // A bot/user may have left before the audit event arrived. Try a direct ban as a final containment step.
        await guild.members.ban(executorId, { deleteMessageSeconds: 0, reason: 'lxcky Security anti-nuke: mass destructive activity' })
            .then(() => { punishmentResult = 'Executor banned'; })
            .catch(() => { punishmentResult = 'Executor left or could not be banned'; });
    }

    await logAlert(global.client, guild.id, 'Anti-Nuke Incident', {
        Executor: executorMention,
        'Trigger Action': actionName,
        'Actions Detected': String(actionCount),
        'Action Taken': punishmentResult,
        'Recovery': settings.antiNukeAutoRestore ? 'Automatic backup restore attempted' : 'Disabled',
    }).catch(() => {});

    if (!settings.antiNukeAutoRestore || recoveringGuilds.has(guild.id)) return;

    const latest = await getLatestBackup(guild.id).catch(() => null);
    if (!latest) {
        await logAlert(global.client, guild.id, 'Anti-Nuke Recovery', {
            Status: 'No backup is available for automatic recovery',
        }).catch(() => {});
        return;
    }

    recoveringGuilds.add(guild.id);
    try {
        await restoreBackup(guild, latest.backupId, { replace: true });
        await logAlert(global.client, guild.id, 'Anti-Nuke Recovery', {
            Status: 'Latest backup restored',
            'Backup ID': latest.backupId,
        }).catch(() => {});
    } catch (error) {
        await logAlert(global.client, guild.id, 'Anti-Nuke Recovery', {
            Status: 'Backup restore failed',
            Error: String(error.message || error).slice(0, 1000),
        }).catch(() => {});
    } finally {
        setTimeout(() => recoveringGuilds.delete(guild.id), 30_000);
    }
}

async function process(entry, guild) {
    if (!guild?.id || !entry?.executorId || !ACTIONS.has(entry.action)) return;
    if (recoveringGuilds.has(guild.id)) return;

    const settings = await GuildSettings.findOne({ guildId: guild.id }).catch(() => null);
    if (!settings?.antiNuke) return;

    if (await isWhitelisted(guild.id, 'user', entry.executorId).catch(() => false)) return;
    if (entry.executor?.bot && await isWhitelisted(guild.id, 'bot', entry.executorId).catch(() => false)) return;

    const now = Date.now();
    const windowMs = Math.max(3000, Number(settings.antiNukeWindow || 10) * 1000);
    const threshold = Math.max(2, Number(settings.antiNukeThreshold || 3));
    const key = recordKey(guild.id, entry.executorId);
    const current = (activity.get(key) || []).filter(item => now - item.at < windowMs);
    current.push({ at: now, action: entry.action });
    activity.set(key, current);

    if (current.length < threshold) return;

    activity.set(key, []);
    const actionName = ACTION_NAMES.get(entry.action) || String(entry.action);
    await contain(guild, entry.executorId, settings, current.length, actionName);
}

function clearGuild(guildId) {
    for (const key of activity.keys()) if (key.startsWith(`${guildId}:`)) activity.delete(key);
    recoveringGuilds.delete(guildId);
}

module.exports = { process, activity, ACTIONS, clearGuild };
