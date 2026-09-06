"use strict";
const mongoose = require('mongoose');

const LinkRuleSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    pattern: { type: String, required: true },
    isRegex: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    bypassRoleIds: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('LinkRule', LinkRuleSchema);
