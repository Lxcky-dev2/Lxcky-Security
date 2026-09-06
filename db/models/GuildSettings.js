"use strict";

const mongoose = require('mongoose');

// Persistent per-guild configuration. This document is stored in MongoDB and is not reset on bot restart/update.
const GuildSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    guildName: { type: String, default: 'Unknown Server' },

    logChannelId: { type: String, default: null },
    alertChannelId: { type: String, default: null },
    memberLogChannelId: { type: String, default: null },
    messageLogChannelId: { type: String, default: null },
    verifyLogChannelId: { type: String, default: null },
    auditLogChannelId: { type: String, default: null },
    welcomeJoinChannelId: { type: String, default: null },
    welcomeLeaveChannelId: { type: String, default: null },
    welcomeJoinEnabled: { type: Boolean, default: true },
    welcomeLeaveEnabled: { type: Boolean, default: true },

    antiNuke: { type: Boolean, default: true },
    antiNukeThreshold: { type: Number, default: 3, min: 2, max: 20 },
    antiNukeWindow: { type: Number, default: 10, min: 3, max: 60 },
    antiNukePunishment: { type: String, enum: ['ban', 'kick', 'none'], default: 'ban' },
    antiNukeAutoRestore: { type: Boolean, default: true },
    antiRaid: { type: Boolean, default: true },
    spamFilter: { type: Boolean, default: true },
    verification: { type: Boolean, default: false },
    globalBlacklist: { type: Boolean, default: true },

    approvalTimeout: { type: Number, default: 10 },
    autoBanTimeout: { type: Boolean, default: true },
    suspiciousRoleId: { type: String, default: null },

    joinThreshold: { type: Number, default: 10 },
    timeWindow: { type: Number, default: 30 },
    lockdownDuration: { type: Number, default: 5 },

    loggingEnabled: { type: Boolean, default: true },
    commandLogChannelId: { type: String, default: null },
    roleLogChannelId: { type: String, default: null },
    channelLogChannelId: { type: String, default: null },
    voiceLogChannelId: { type: String, default: null },
    securityLogChannelId: { type: String, default: null },

    antiRaidExternalMode: { type: String, enum: ['disabled', 'monitor', 'duringRaid', 'always'], default: 'disabled' },
    antiRaidExternalAllChannels: { type: Boolean, default: true },
    antiRaidExternalChannelIds: { type: [String], default: [] },
    antiRaidExternalBypassRoleIds: { type: [String], default: [] },
    antiRaidExternalBypassUserIds: { type: [String], default: [] },
    antiRaidExternalSnapshots: { type: mongoose.Schema.Types.Mixed, default: {} },

    spamThreshold: { type: Number, default: 5 },
    muteDuration: { type: Number, default: 10 },

    adminRoleIds: { type: [String], default: [] },
    modRoleIds: { type: [String], default: [] },
    logViewerRoleIds: { type: [String], default: [] },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

GuildSettingsSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('GuildSettings', GuildSettingsSchema);