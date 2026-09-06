"use strict";

const { checkSuspiciousJoin } = require('../utils/securityChecks.js');
const { checkRaid } = require('../utils/antiRaid.js');

module.exports = {
    async execute(member) {
        await checkSuspiciousJoin(member);
        await checkRaid(member);
    }
};