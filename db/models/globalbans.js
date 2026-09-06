"use strict";

const mongoose = require('mongoose');

const GlobalBanSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    reason: { type: String, default: 'No reason provided' },
    bannedBy: { type: String, required: true },
    bannedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    sourceGuildId: { type: String, default: null },
    evidence: { type: String, default: null },
    appealStatus: { type: String, enum: ['none', 'pending', 'approved', 'denied'], default: 'none' }
});

module.exports = mongoose.model('GlobalBan', GlobalBanSchema);