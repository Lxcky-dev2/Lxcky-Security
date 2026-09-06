"use strict";

const mongoose = require('mongoose');

const AFKSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    reason: { type: String, default: 'No reason provided' },
    setAt: { type: Date, default: Date.now }
});

// Compound unique index to prevent duplicate AFK entries per user per guild
AFKSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('AFK', AFKSchema);