"use strict";
const mongoose = require('mongoose');

const GiveawaySchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    hostId: { type: String, required: true },
    prize: { type: String, required: true },
    description: { type: String, default: 'Enter the giveaway below.' },
    winners: { type: Number, default: 1, min: 1, max: 50 },
    endAt: { type: Date, required: true, index: true },
    participants: { type: [String], default: [] },
    ended: { type: Boolean, default: false, index: true },
    endedAt: { type: Date, default: null },
    winnerIds: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Giveaway', GiveawaySchema);
