"use strict";

const OwnerConfig = require('../db/models/OwnerConfig.js');
const DatabaseAudit = require('../db/models/DatabaseAudit.js');
const { createMessage, COLORS } = require('./componentBuilder.js');

async function getOwnerConfig() {
    let cfg = await OwnerConfig.findOne({ key: 'owner' });
    if (!cfg) cfg = await OwnerConfig.create({ key: 'owner' });
    return cfg;
}

function isOwner(userId) {
    return userId === process.env.OWNER_ID;
}

async function getStaff(userId) {
    const cfg = await getOwnerConfig();
    const staff = cfg.trustedStaff.find(s => s.userId === userId) || null;
    if (!staff) return null;

    // Do not silently re-enable permissions here. The owner panel controls
    // these flags and trusted staff should only receive what the owner grants.
    if (!staff.database) staff.database = {};
    if (!staff.reports) staff.reports = {};

    return staff;
}

async function hasGlobalPermission(userId, permission) {
    if (isOwner(userId)) return true;
    const staff = await getStaff(userId);
    if (!staff) return false;

    if (permission === 'db.search' || permission === 'db.view') return !!(staff.database.search || staff.database.view);
    if (permission === 'db.add') return !!staff.database.add;
    if (permission === 'db.edit') return !!staff.database.edit;
    if (permission === 'db.remove') return !!staff.database.remove;
    if (permission === 'db.status') return !!staff.database.status;
    if (permission === 'report.view') return !!staff.reports.view;
    if (permission === 'report.investigate') return !!staff.reports.investigate;
    if (permission === 'report.resolve') return !!staff.reports.resolve;
    return false;
}

async function resolveConfiguredChannel(cfg, key) {
    if (!cfg.mainGuildId || !cfg.channels?.[key]) return null;
    const client = global.client;
    const guild = client?.guilds?.cache?.get(cfg.mainGuildId);
    if (!guild) return null;
    return guild.channels.cache.get(cfg.channels[key]) || null;
}

async function auditDatabase({ action, discordId, type, status, reason, actorId, sourceGuildId }) {
    const audit = await DatabaseAudit.create({
        action,
        discordId,
        type,
        status,
        reason,
        actorId,
        sourceGuildId
    });

    const cfg = await getOwnerConfig();
    const channel = await resolveConfiguredChannel(cfg, 'databaseAudit');

    if (!channel?.isTextBased()) {
        console.warn('[DATABASE AUDIT] No valid database audit channel configured. Audit was saved to MongoDB only.');
        return audit;
    }

    await channel.send({
        ...createMessage({
            title: ' Database Audit',
            data: {
                Action: action,
                Type: type,
                'Discord ID': discordId,
                Status: status || '-',
                Reason: reason || '-',
                'Changed By': `<@${actorId}>`,
                'Source Guild ID': sourceGuildId || 'Owner Panel',
                Time: new Date().toUTCString()
            },
            color: action.includes('REMOVE') ? COLORS.warning : COLORS.default
        })
    }).catch(error => {
        console.error('[DATABASE AUDIT] Failed to send audit message:', error);
    });

    return audit;
}

function ownerOnly(interaction) {
    return isOwner(interaction.user.id);
}

module.exports = {
    getOwnerConfig,
    isOwner,
    getStaff,
    hasGlobalPermission,
    auditDatabase,
    ownerOnly,
    resolveConfiguredChannel
};
