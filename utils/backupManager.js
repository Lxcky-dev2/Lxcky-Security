"use strict";

const {
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');
const ServerBackup = require('../db/models/ServerBackups.js');
const rateLimitManager = require('./rateLimitManager.js');

const BACKUP_RETENTION = 10;
const AUTO_INTERVAL = 6 * 60 * 60 * 1000;
const AUTO_CREATE_DELAY = 30 * 1000;
let autoTimer = null;
let autoStarted = false;

function serializeOverwrite(overwrite) {
    return {
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString(),
    };
}

function serializeChannel(channel) {
    const data = {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId || null,
        position: channel.rawPosition ?? channel.position ?? 0,
        permissionOverwrites: channel.permissionOverwrites
            ? [...channel.permissionOverwrites.cache.values()].map(serializeOverwrite)
            : [],
        topic: 'topic' in channel ? (channel.topic || null) : null,
        nsfw: 'nsfw' in channel ? !!channel.nsfw : false,
        rateLimitPerUser: 'rateLimitPerUser' in channel ? Number(channel.rateLimitPerUser || 0) : 0,
    };

    if ('bitrate' in channel) data.bitrate = channel.bitrate;
    if ('userLimit' in channel) data.userLimit = channel.userLimit;
    if ('rtcRegion' in channel) data.rtcRegion = channel.rtcRegion || null;
    if ('videoQualityMode' in channel) data.videoQualityMode = channel.videoQualityMode ?? null;
    if ('defaultAutoArchiveDuration' in channel) data.defaultAutoArchiveDuration = channel.defaultAutoArchiveDuration ?? null;
    if ('defaultThreadRateLimitPerUser' in channel) data.defaultThreadRateLimitPerUser = channel.defaultThreadRateLimitPerUser ?? 0;
    if ('defaultSortOrder' in channel) data.defaultSortOrder = channel.defaultSortOrder ?? null;
    if ('defaultForumLayout' in channel) data.defaultForumLayout = channel.defaultForumLayout ?? null;
    if ('availableTags' in channel) {
        data.availableTags = (channel.availableTags || []).map(tag => ({
            id: tag.id,
            name: tag.name,
            moderated: !!tag.moderated,
            emojiId: tag.emojiId || null,
            emojiName: tag.emojiName || null,
        }));
    }
    if ('defaultReactionEmoji' in channel) {
        data.defaultReactionEmoji = channel.defaultReactionEmoji
            ? { emojiId: channel.defaultReactionEmoji.emojiId || null, emojiName: channel.defaultReactionEmoji.emojiName || null }
            : null;
    }

    return data;
}

function serializeRole(role) {
    return {
        id: role.id,
        name: role.name,
        color: role.color,
        permissions: role.permissions.bitfield.toString(),
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position,
        managed: !!role.managed,
    };
}

function serializeGuild(guild) {
    return {
        name: guild.name,
        description: guild.description || null,
        verificationLevel: guild.verificationLevel,
        explicitContentFilter: guild.explicitContentFilter,
        defaultMessageNotifications: guild.defaultMessageNotifications,
        afkTimeout: guild.afkTimeout,
        afkChannelId: guild.afkChannelId || null,
        systemChannelId: guild.systemChannelId || null,
        systemChannelFlags: guild.systemChannelFlags?.bitfield?.toString?.() || '0',
        preferredLocale: guild.preferredLocale || null,
        iconURL: guild.iconURL({ extension: 'png', size: 1024 }) || null,
        bannerURL: guild.bannerURL({ extension: 'png', size: 1024 }) || null,
        splashURL: guild.splashURL({ extension: 'png', size: 1024 }) || null,
    };
}

async function createBackup(guild, createdBy, options = {}) {
    if (!guild?.id) throw new Error('Invalid guild');

    // Always fetch the live collections before snapshotting so a backup is not based on stale cache data.
    await guild.roles.fetch().catch(() => {});
    await guild.channels.fetch().catch(() => {});
    await guild.emojis.fetch().catch(() => {});

    const channels = [...guild.channels.cache.values()]
        .filter(channel => channel && typeof channel.type === 'number')
        .filter(channel => !channel.isThread?.());

    const roles = [...guild.roles.cache.values()]
        .filter(role => !role.managed)
        .map(serializeRole)
        .sort((a, b) => a.position - b.position);

    const emojis = [...guild.emojis.cache.values()].map(emoji => ({
        id: emoji.id,
        name: emoji.name,
        animated: !!emoji.animated,
        url: emoji.imageURL({ extension: emoji.animated ? 'gif' : 'png', size: 256 }),
        roles: emoji.roles?.cache ? [...emoji.roles.cache.keys()] : [],
    }));

    const snapshot = {
        version: 2,
        createdAt: new Date().toISOString(),
        guild: serializeGuild(guild),
        roles,
        channels: channels.map(serializeChannel),
        emojis,
    };

    const backupId = `bkp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const backup = await ServerBackup.create({
        guildId: guild.id,
        backupId,
        createdBy,
        automatic: !!options.automatic,
        snapshot,
    });

    await pruneBackups(guild.id, BACKUP_RETENTION);
    return backup;
}

function channelCreateOptions(channelData, parentId, roleIdMap, guild) {
    const overwrites = (channelData.permissionOverwrites || []).map(overwrite => {
        const mappedId = overwrite.id === guild.roles.everyone.id
            ? guild.roles.everyone.id
            : roleIdMap.get(overwrite.id) || overwrite.id;
        return {
            id: mappedId,
            type: overwrite.type,
            allow: BigInt(overwrite.allow || '0'),
            deny: BigInt(overwrite.deny || '0'),
        };
    });

    const options = {
        name: channelData.name,
        type: channelData.type,
        parent: parentId || undefined,
        position: channelData.position,
        permissionOverwrites: overwrites,
        reason: 'lxcky Security backup restore',
    };

    if ([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia].includes(channelData.type)) {
        if (channelData.topic != null) options.topic = channelData.topic;
        options.nsfw = !!channelData.nsfw;
        options.rateLimitPerUser = Number(channelData.rateLimitPerUser || 0);
    }
    if (channelData.type === ChannelType.GuildVoice || channelData.type === ChannelType.GuildStageVoice) {
        if (channelData.bitrate) options.bitrate = channelData.bitrate;
        if (channelData.userLimit != null) options.userLimit = channelData.userLimit;
        if (channelData.rtcRegion) options.rtcRegion = channelData.rtcRegion;
        if (channelData.videoQualityMode != null) options.videoQualityMode = channelData.videoQualityMode;
    }

    return options;
}

async function restoreBackup(guild, backupId, options = {}) {
    const backup = await ServerBackup.findOne({ guildId: guild.id, backupId });
    if (!backup) throw new Error('Backup not found');

    const snapshot = backup.snapshot || {};
    const roleData = Array.isArray(snapshot.roles) ? snapshot.roles : [];
    const channelData = Array.isArray(snapshot.channels) ? snapshot.channels : [];
    const guildData = snapshot.guild || snapshot.settings || {};

    // Reconcile roles first. Existing roles with matching IDs are updated; deleted roles are recreated.
    // Managed/integration roles and @everyone are never deleted or force-edited.
    const roleIdMap = new Map();
    roleIdMap.set(guild.roles.everyone.id, guild.roles.everyone.id);

    for (const data of roleData) {
        const existing = guild.roles.cache.get(data.id);
        if (existing && !existing.managed) {
            roleIdMap.set(data.id, existing.id);
            await rateLimitManager.enqueue(() => existing.edit({
                name: data.name,
                color: data.color,
                permissions: BigInt(data.permissions || '0'),
                hoist: !!data.hoist,
                mentionable: !!data.mentionable,
                reason: 'lxcky Security backup restore',
            })).catch(() => {});
        } else if (!existing) {
            const created = await rateLimitManager.enqueue(() => guild.roles.create({
                name: data.name,
                color: data.color,
                permissions: BigInt(data.permissions || '0'),
                hoist: !!data.hoist,
                mentionable: !!data.mentionable,
                reason: 'lxcky Security backup restore',
            })).catch(() => null);
            if (created) roleIdMap.set(data.id, created.id);
        }
    }

    // Optionally remove roles that weren't in the backup. This is critical after a nuke.
    if (options.replace !== false) {
        const backedRoleIds = new Set(roleData.map(r => r.id));
        for (const role of guild.roles.cache.values()) {
            if (role.managed || role.id === guild.roles.everyone.id) continue;
            if (backedRoleIds.has(role.id)) continue;
            await rateLimitManager.enqueue(() => role.delete('lxcky Security backup restore - remove extra role')).catch(() => {});
        }
    }

    // Create categories first so child channels can be restored under the correct recreated category.
    const channelIdMap = new Map();
    const categories = channelData.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
    const nonCategories = channelData.filter(c => c.type !== ChannelType.GuildCategory).sort((a, b) => a.position - b.position);

    for (const data of categories) {
        const existing = guild.channels.cache.get(data.id);
        if (existing && existing.type === ChannelType.GuildCategory) {
            channelIdMap.set(data.id, existing.id);
            await applyChannelState(existing, data, null, roleIdMap, guild);
        } else if (!existing) {
            const created = await rateLimitManager.enqueue(() => guild.channels.create(channelCreateOptions(data, null, roleIdMap, guild))).catch(() => null);
            if (created) channelIdMap.set(data.id, created.id);
        }
    }

    for (const data of nonCategories) {
        const parentId = data.parentId ? channelIdMap.get(data.parentId) || null : null;
        const existing = guild.channels.cache.get(data.id);
        if (existing && !existing.isThread?.()) {
            channelIdMap.set(data.id, existing.id);
            await applyChannelState(existing, data, parentId, roleIdMap, guild);
        } else if (!existing) {
            const created = await rateLimitManager.enqueue(() => guild.channels.create(channelCreateOptions(data, parentId, roleIdMap, guild))).catch(() => null);
            if (created) channelIdMap.set(data.id, created.id);
        }
    }

    if (options.replace !== false) {
        const backedChannelIds = new Set(channelData.map(c => c.id));
        for (const channel of guild.channels.cache.values()) {
            if (channel.isThread?.()) continue;
            if (backedChannelIds.has(channel.id)) continue;
            // Do not delete channels Discord will not allow the bot to delete.
            await rateLimitManager.enqueue(() => channel.delete('lxcky Security backup restore - remove extra channel')).catch(() => {});
        }
    }

    // Restore ordering after IDs have been reconciled.
    const ordered = channelData
        .filter(data => data.type !== ChannelType.GuildCategory)
        .map(data => ({ id: channelIdMap.get(data.id), position: data.position }))
        .filter(x => x.id);
    for (const item of ordered) {
        const channel = guild.channels.cache.get(item.id);
        if (!channel) continue;
        await channel.setPosition(item.position).catch(() => {});
    }

    // Restore guild-level settings where Discord permits it.
    const guildEdits = {};
    if (guildData.name && guildData.name !== guild.name) guildEdits.name = guildData.name;
    if (guildData.description !== undefined) guildEdits.description = guildData.description;
    if (guildData.verificationLevel != null) guildEdits.verificationLevel = guildData.verificationLevel;
    if (guildData.explicitContentFilter != null) guildEdits.explicitContentFilter = guildData.explicitContentFilter;
    if (guildData.defaultMessageNotifications != null) guildEdits.defaultMessageNotifications = guildData.defaultMessageNotifications;
    if (guildData.afkTimeout != null) guildEdits.afkTimeout = guildData.afkTimeout;
    if (guildData.iconURL) guildEdits.icon = guildData.iconURL;
    if (guildData.bannerURL) guildEdits.banner = guildData.bannerURL;
    if (guildData.splashURL) guildEdits.splash = guildData.splashURL;
    if (Object.keys(guildEdits).length) {
        await rateLimitManager.enqueue(() => guild.edit(guildEdits)).catch(() => {});
    }

    // Recreate custom emojis when possible. Existing names are preserved; failed emoji restores are non-fatal.
    if (Array.isArray(snapshot.emojis) && guild.emojis?.cache) {
        const existingByName = new Map([...guild.emojis.cache.values()].map(e => [e.name, e]));
        for (const emoji of snapshot.emojis) {
            if (!emoji?.name || !emoji.url || existingByName.has(emoji.name)) continue;
            await rateLimitManager.enqueue(() => guild.emojis.create({
                attachment: emoji.url,
                name: emoji.name,
                reason: 'lxcky Security backup restore',
            })).catch(() => {});
        }
    }

    backup.restoredAt = new Date();
    backup.restoredBy = guild.client.user?.id || null;
    await backup.save();

    return backup;
}

async function applyChannelState(channel, data, parentId, roleIdMap, guild) {
    const edit = {
        name: data.name,
        position: data.position,
        reason: 'lxcky Security backup restore',
    };
    if ('topic' in data && 'topic' in channel) edit.topic = data.topic || null;
    if ('nsfw' in data && 'nsfw' in channel) edit.nsfw = !!data.nsfw;
    if ('rateLimitPerUser' in data && 'rateLimitPerUser' in channel) edit.rateLimitPerUser = Number(data.rateLimitPerUser || 0);
    if ('parentId' in data) edit.parent = parentId || null;

    await rateLimitManager.enqueue(() => channel.edit(edit)).catch(() => {});

    // Reset current overwrites first so deleted permissions don't remain after restore.
    for (const overwrite of channel.permissionOverwrites?.cache?.values?.() || []) {
        await channel.permissionOverwrites.delete(overwrite.id, 'lxcky Security backup restore - reset overwrite').catch(() => {});
    }

    for (const overwrite of data.permissionOverwrites || []) {
        const mappedId = overwrite.id === guild.roles.everyone.id
            ? guild.roles.everyone.id
            : roleIdMap.get(overwrite.id) || overwrite.id;
        await channel.permissionOverwrites.edit(mappedId, {
            allow: BigInt(overwrite.allow || '0'),
            deny: BigInt(overwrite.deny || '0'),
        }, { reason: 'lxcky Security backup restore' }).catch(() => {});
    }
}

async function getLatestBackup(guildId) {
    return ServerBackup.findOne({ guildId }).sort({ timestamp: -1 });
}

async function pruneBackups(guildId, keep = BACKUP_RETENTION) {
    const backups = await ServerBackup.find({ guildId }).sort({ timestamp: -1 }).skip(keep);
    if (backups.length) await ServerBackup.deleteMany({ _id: { $in: backups.map(b => b._id) } });
}

async function startAutomaticBackups(client) {
    if (autoStarted) return;
    autoStarted = true;

    const run = async () => {
        for (const guild of client.guilds.cache.values()) {
            try {
                const latest = await getLatestBackup(guild.id);
                if (!latest || Date.now() - latest.timestamp.getTime() >= AUTO_INTERVAL) {
                    await createBackup(guild, client.user.id, { automatic: true });
                    console.log(`[BACKUP] Automatic backup created: ${guild.name}`);
                }
            } catch (error) {
                console.error(`[BACKUP] Automatic backup failed for ${guild.id}:`, error.message || error);
            }
        }
    };

    setTimeout(() => run().catch(() => {}), AUTO_CREATE_DELAY);
    autoTimer = setInterval(() => run().catch(() => {}), AUTO_INTERVAL);
}

module.exports = {
    createBackup,
    restoreBackup,
    getLatestBackup,
    pruneBackups,
    startAutomaticBackups,
};
