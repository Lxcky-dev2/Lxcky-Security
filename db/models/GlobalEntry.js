"use strict";
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['user', 'bot'], required: true },
  status: { type: String, enum: ['trusted', 'suspicious', 'blacklisted'], default: 'suspicious' },
  reason: { type: String, default: 'No reason provided' },
  evidence: { type: String, default: null },
  addedBy: { type: String, required: true },
  updatedBy: { type: String, default: null },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
schema.pre('save', function(next) { this.updatedAt = new Date(); next(); });
module.exports = mongoose.model('GlobalEntry', schema);
