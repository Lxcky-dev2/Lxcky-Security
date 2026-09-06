"use strict";

const { PermissionFlagsBits } = require('discord.js');

const DISCORD_PERMISSIONS = Object.freeze({ ...PermissionFlagsBits });

const COMMAND_PERMISSIONS = Object.freeze({
    ban: PermissionFlagsBits.BanMembers,
    unban: PermissionFlagsBits.BanMembers,
    softban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    timeout: PermissionFlagsBits.ModerateMembers,
    untimeout: PermissionFlagsBits.ModerateMembers,
    warn: PermissionFlagsBits.ModerateMembers,
    warnings: PermissionFlagsBits.ModerateMembers,
    clearwarnings: PermissionFlagsBits.ModerateMembers,
    verify: PermissionFlagsBits.ModerateMembers,
    purge: PermissionFlagsBits.ManageMessages,
    slowmode: PermissionFlagsBits.ManageChannels,
    nick: PermissionFlagsBits.ManageNicknames,
    role: PermissionFlagsBits.ManageRoles,
    voicemute: PermissionFlagsBits.MuteMembers,
    unvoicemute: PermissionFlagsBits.MuteMembers,
    deafen: PermissionFlagsBits.DeafenMembers,
    undeafen: PermissionFlagsBits.DeafenMembers,
    settings: PermissionFlagsBits.ManageGuild,
    tickets: PermissionFlagsBits.ManageGuild,
    welcomer: PermissionFlagsBits.ManageGuild,
    links: PermissionFlagsBits.ManageGuild,
    giveaway: PermissionFlagsBits.ManageGuild,
    backup: PermissionFlagsBits.ManageGuild,
    lockdown: PermissionFlagsBits.Administrator,
    automod: PermissionFlagsBits.ManageGuild,
    logs: PermissionFlagsBits.ManageGuild,
    antinuke: PermissionFlagsBits.ManageGuild,
    whitelist: PermissionFlagsBits.ManageGuild,
});

function resolvePermission(permission) {
    if (!permission) return null;
    if (typeof permission === 'bigint') return permission;
    if (typeof permission === 'number' || (typeof permission === 'string' && /^\d+$/.test(permission))) return BigInt(permission);
    if (Object.prototype.hasOwnProperty.call(PermissionFlagsBits, permission)) return PermissionFlagsBits[permission];
    return null;
}

function hasDiscordPermission(member, permission, { allowAdministrator = true } = {}) {
    if (!member?.permissions) return false;
    const required = resolvePermission(permission);
    if (required === null) return false;
    if (allowAdministrator && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return member.permissions.has(required);
}

function hasAnyDiscordPermission(member, permissions, options = {}) {
    return permissions.some(permission => hasDiscordPermission(member, permission, options));
}

function commandHasPermission(member, commandName, explicitPermission = null) {
    const required = explicitPermission || COMMAND_PERMISSIONS[commandName];
    if (!required) return true;
    return hasDiscordPermission(member, required);
}

module.exports = {
    DISCORD_PERMISSIONS,
    COMMAND_PERMISSIONS,
    resolvePermission,
    hasDiscordPermission,
    hasAnyDiscordPermission,
    commandHasPermission,
};
