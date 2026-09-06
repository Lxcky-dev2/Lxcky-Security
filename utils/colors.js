"use strict";

// Base colors from componentBuilder
const { COLORS } = require('./componentBuilder.js');

// Extended security colors
const SECURITY_COLORS = {
    // Keep existing
    default: COLORS.default,
    success: COLORS.success,
    danger: COLORS.danger,
    warning: COLORS.warning,

    // Security-specific
    critical: 0x800020,      // Dark red for critical threats
    info: 0x00BFFF,          // Deep sky blue for informational
    audit: 0x808080,         // Gray for audit logs
    verified: 0x00FF7F,      // Spring green for verified users
    locked: 0xFF4500,        // Orange-red for lockdown events
    suspicious: 0xFF8C00,    // Dark orange for suspicious activity
    trusted: 0x2D1B4E,       // Deep purple for trusted status
};

module.exports = { COLORS, SECURITY_COLORS };