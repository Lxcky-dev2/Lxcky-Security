"use strict";

const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    dcId: { type: String, required: true },
    guildId: { type: String, required: true },
    
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },

    warnings: [{
        reason: { type: String, required: true },
        moderatorId: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        caseId: { type: String, required: true }
    }],

    activeTimeout: {
        until: { type: Date, default: null },
        reason: { type: String, default: null },
        moderatorId: { type: String, default: null }
    },

    riskScore: { type: Number, default: 0 },
    joinDate: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    lastReportAt: { type: Date, default: null }
});

// Compound unique index on dcId + guildId
AccountSchema.index({ dcId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('Account', AccountSchema);