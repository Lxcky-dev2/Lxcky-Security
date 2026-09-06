"use strict";

const { 
    createMessage, 
    COLORS 
} = require('./componentBuilder.js');

const { 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

const Account = require('../db/models/Account.js');
const GlobalEntry = require('../db/models/GlobalEntry.js');

async function getUserAccount(dcId, guildId) {
    let account = await Account.findOne({ dcId, guildId });
    if (account) return account;

    account = new Account({ dcId, guildId, joinDate: new Date() });
    try {
        await account.save();
        return account;
    } catch (err) {
        if (err.code === 11000) {
            const existing = await Account.findOne({ dcId, guildId });
            if (existing) return existing;
        }
        throw err;
    }
}

function buildDashboard(account, user, globalBanStatus) {
    const warningCount = account.warnings ? account.warnings.length : 0;
    const isTimedOut = account.activeTimeout && account.activeTimeout.until > new Date();

    const data = {
        'Status': account.isVerified ? 'Verified Member' : 'Unverified',
        'Warnings': `${warningCount} / 3`,
        'Risk Score': `${account.riskScore}%`,
        'Active Timeout': isTimedOut ? `Until ${account.activeTimeout.until.toUTCString()}` : 'None',
        'Global Blacklist': globalBanStatus ? 'Blacklisted' : 'Clean'
    };

    // Buttons using native builders
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dashboard_report')
            .setLabel('Report a User')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('dashboard_warnings')
            .setLabel('View My Warnings')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dashboard_refresh')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
    );

    return createMessage({
        title: `User Dashboard - ${user.username}`,
        data,
        color: globalBanStatus ? COLORS.danger : COLORS.default,
        components: [row1, row2],
        footer: `lxcky security - User ID: ${user.id}`,
        ephemeral: true
    });
}

function buildWarningsPanel(account, user) {
    if (!account.warnings || account.warnings.length === 0) {
        return createMessage({
            title: 'My Warnings',
            data: { 'Status': 'No warnings on record' },
            color: COLORS.success,
            ephemeral: true
        });
    }

    const warningList = account.warnings.map((w, i) => {
        return `#${w.caseId} | ${w.reason} | Moderator: <@${w.moderatorId}> | ${new Date(w.timestamp).toUTCString()}`;
    }).join('\n');

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dashboard_back')
            .setLabel('Back to Dashboard')
            .setStyle(ButtonStyle.Secondary)
    );

    return createMessage({
        title: `My Warnings - ${user.username}`,
        data: { 'Warnings': `\`\`\`${warningList}\`\`\`` },
        color: COLORS.warning,
        components: [backRow],
        ephemeral: true
    });
}

function buildReportModal() {
    const modal = new ModalBuilder()
        .setCustomId('report_modal')
        .setTitle('Report a User');

    const userIdInput = new TextInputBuilder()
        .setCustomId('report_user_id')
        .setLabel('User ID to Report')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter the Discord User ID')
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(19);

    const reasonInput = new TextInputBuilder()
        .setCustomId('report_reason')
        .setLabel('Reason for Report')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe what this user did...')
        .setRequired(true)
        .setMaxLength(500);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(reasonInput)
    );

    return modal;
}

async function handleUserDashboard(interaction) {
    const customId = interaction.customId;

    if (customId === 'dashboard_refresh' || customId === 'dashboard_back') {
        const account = await getUserAccount(interaction.user.id, interaction.guildId);
        const globalBan = await GlobalEntry.findOne({ discordId: interaction.user.id, active: true, status: 'blacklisted' });
        await interaction.update(buildDashboard(account, interaction.user, !!globalBan));
        return;
    }

    if (customId === 'dashboard_warnings') {
        const account = await getUserAccount(interaction.user.id, interaction.guildId);
        await interaction.update(buildWarningsPanel(account, interaction.user));
        return;
    }

    if (customId === 'dashboard_report') {
        await interaction.showModal(buildReportModal());
        return;
    }
}

module.exports = {
    getUserAccount,
    buildDashboard,
    buildWarningsPanel,
    handleUserDashboard
};