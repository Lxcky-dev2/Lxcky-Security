"use strict";

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const SecurityReport = require('../db/models/SecurityReport.js');
const { getOwnerConfig, hasGlobalPermission, resolveConfiguredChannel } = require('./ownerConfig.js');
const { COLORS } = require('./componentBuilder.js');

function reportToggleKey(kind) {
    return {
        suspicious_bot: 'suspiciousBots',
        blacklisted_bot: 'blacklistedBots',
        blacklisted_user: 'blacklistedUsers',
        anti_nuke: 'antiNuke',
        anti_raid: 'antiRaid',
        user_report: 'userReports'
    }[kind];
}

function buildReportEmbed(report) {
    return new EmbedBuilder()
        .setTitle(`Security Report - ${report.kind}`)
        .setColor(COLORS.danger)
        .addFields(
            { name: 'Server', value: report.guildName || report.guildId || 'Unknown', inline: true },
            { name: 'Server ID', value: report.guildId || '-', inline: true },
            { name: 'Target', value: report.targetTag ? `${report.targetTag} (${report.targetId || '-'})` : (report.targetId || '-'), inline: false },
            { name: 'Action', value: report.action || '-', inline: true },
            { name: 'Reason', value: report.reason || '-', inline: true },
            { name: 'Report ID', value: report.reportId, inline: false }
        )
        .setTimestamp(report.createdAt || new Date());
}

function buildReportComponents(reportId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`report_investigate_${reportId}`)
            .setLabel('Investigate')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`report_resolve_${reportId}`)
            .setLabel('Resolve')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`report_ignore_${reportId}`)
            .setLabel('Ignore')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );
}

async function createSecurityReport(data) {
    const cfg = await getOwnerConfig();
    const toggle = reportToggleKey(data.kind);
    if (toggle && cfg.reportTypes[toggle] === false) return null;

    let report;
    try {
        report = await SecurityReport.create(data);
    } catch (error) {
        console.error('[REPORT] Failed to create central report:', error);
        return null;
    }

    const channel = await resolveConfiguredChannel(cfg, 'securityReports');
    if (!channel?.isTextBased()) {
        console.warn('[REPORT] No valid security report channel configured. Report was saved to MongoDB only.');
        return report;
    }

    try {
        const msg = await channel.send({
            embeds: [buildReportEmbed(report)],
            components: [buildReportComponents(report.reportId)]
        });

        report.messageId = msg.id;
        report.channelId = channel.id;
        await report.save();
    } catch (error) {
        console.error('[REPORT] Failed to send central report:', error);
    }

    return report;
}

async function handleReportComponent(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const reportId = parts.slice(2).join('_');

    const permission = action === 'resolve' || action === 'ignore'
        ? 'report.resolve'
        : 'report.investigate';

    if (!(await hasGlobalPermission(interaction.user.id, permission))) {
        return interaction.reply({
            content: 'You are not trusted to handle central security reports.',
            flags: MessageFlags.Ephemeral
        });
    }

    const report = await SecurityReport.findOne({
        $or: [
            { reportId },
            ...(reportId.match(/^[a-f0-9]{24}$/i) ? [{ _id: reportId }] : [])
        ]
    });

    if (!report) {
        return interaction.reply({
            content: 'Report no longer exists.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (action === 'resolve' || action === 'ignore') {
        if (report.status !== 'open') {
            return interaction.reply({
                content: `This report is already ${report.status}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        report.status = action === 'resolve' ? 'resolved' : 'ignored';
        report.resolvedAt = new Date();
        report.resolvedBy = interaction.user.id;
        await report.save();

        const embed = buildReportEmbed(report)
            .setTitle(action === 'resolve' ? 'Security Report - Resolved' : 'Security Report - Ignored')
            .setColor(action === 'resolve' ? COLORS.success : COLORS.warning)
            .addFields({
                name: 'Handled By',
                value: `<@${interaction.user.id}>`,
                inline: true
            });

        return interaction.update({
            embeds: [embed],
            components: [buildReportComponents(report.reportId, true)]
        });
    }

    if (action === 'investigate') {
        const embed = buildReportEmbed(report)
            .setTitle('Security Report - Investigation')
            .setColor(COLORS.warning)
            .addFields(
                { name: 'Status', value: report.status, inline: true },
                { name: 'Submitted', value: report.createdAt ? report.createdAt.toUTCString() : '-', inline: true }
            );

        return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.reply({
        content: 'Unknown report action.',
        flags: MessageFlags.Ephemeral
    });
}

module.exports = { createSecurityReport, handleReportComponent };
