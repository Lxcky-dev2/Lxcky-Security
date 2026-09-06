"use strict";

const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    caseId: { type: String, required: true, unique: true },
    action: { type: String, required: true },
    targetUserId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: 'No reason provided' },
    metadata: { type: Object, default: {} },
    timestamp: { type: Date, default: Date.now }
});

LogSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
LogSchema.index({ guildId: 1, targetUserId: 1 });

module.exports = mongoose.model('Log', LogSchema);