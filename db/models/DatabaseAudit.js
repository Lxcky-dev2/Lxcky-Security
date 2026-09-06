"use strict";
const mongoose = require('mongoose');
module.exports = mongoose.model('DatabaseAudit', new mongoose.Schema({
  action: { type: String, required: true },
  discordId: { type: String, required: true },
  type: { type: String, default: 'unknown' },
  status: { type: String, default: null },
  reason: { type: String, default: null },
  actorId: { type: String, required: true },
  sourceGuildId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}));
