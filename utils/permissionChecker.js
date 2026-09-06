"use strict";
const { PermissionFlagsBits } = require('discord.js');
const { hasDiscordPermission } = require('./permissions.js');

async function hasPermission(member, level) {
    if (!member) return false;
    const map = {
        admin: PermissionFlagsBits.ManageGuild,
        mod: null,
        manageChannels: PermissionFlagsBits.ManageChannels,
        banMembers: PermissionFlagsBits.BanMembers,
        kickMembers: PermissionFlagsBits.KickMembers,
        moderateMembers: PermissionFlagsBits.ModerateMembers,
        manageRoles: PermissionFlagsBits.ManageRoles,
        manageNicknames: PermissionFlagsBits.ManageNicknames,
        manageMessages: PermissionFlagsBits.ManageMessages,
        manageWebhooks: PermissionFlagsBits.ManageWebhooks,
        manageGuild: PermissionFlagsBits.ManageGuild,
        muteMembers: PermissionFlagsBits.MuteMembers,
        deafenMembers: PermissionFlagsBits.DeafenMembers,
        administrator: PermissionFlagsBits.Administrator,
        logViewer: PermissionFlagsBits.ViewAuditLog,
        database: null,
    };
    if (level === 'mod') {
        return hasDiscordPermission(member, PermissionFlagsBits.ModerateMembers) ||
            hasDiscordPermission(member, PermissionFlagsBits.KickMembers) ||
            hasDiscordPermission(member, PermissionFlagsBits.BanMembers);
    }
    if (level === 'database') return false;
    if (!(level in map)) return false;
    return hasDiscordPermission(member, map[level], { allowAdministrator: level !== 'administrator' });
}

async function hasAnyPermission(member, levels) {
    for (const level of levels) if (await hasPermission(member, level)) return true;
    return false;
}

module.exports = { hasPermission, hasAnyPermission };
