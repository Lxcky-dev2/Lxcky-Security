"use strict";

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    MessageFlags,
    EmbedBuilder
} = require('discord.js');
const GlobalEntry = require('../db/models/GlobalEntry.js');
const SecurityReport = require('../db/models/SecurityReport.js');
const { getStaff, hasGlobalPermission } = require('./ownerConfig.js');
const { createMessage, createActionRow, createButton, COLORS } = require('./componentBuilder.js');

function can(staff, key, owner = false) {
    if (owner) return true;
    if (key.startsWith('db.')) return !!staff?.database?.[key.slice(3)];
    if (key.startsWith('report.')) return !!staff?.reports?.[key.slice(7)];
    return false;
}

async function staffPanel(interaction, staff = null) {
    const owner = interaction.user.id === process.env.OWNER_ID;
    staff = staff || await getStaff(interaction.user.id);

    return createMessage({
        title: 'LXCKY SECURITY - STAFF PANEL',
        data: {
            Access: owner ? 'Owner' : 'Trusted Staff',
            Database: can(staff, 'db.view', owner) ? 'Enabled' : 'Restricted',
            Reports: can(staff, 'report.view', owner) ? 'Enabled' : 'Restricted'
        },
        color: COLORS.default,
        components: [
            createActionRow(
                createButton({ label: 'Database', customId: 'staff_database', style: 'primary', disabled: !can(staff, 'db.view', owner) }),
                createButton({ label: 'Reports', customId: 'staff_reports', style: 'danger', disabled: !can(staff, 'report.view', owner) }),
                createButton({ label: 'Permissions', customId: 'staff_permissions', style: 'secondary' })
            ),
            createActionRow(
                createButton({ label: 'Refresh', customId: 'staff_home', style: 'secondary' })
            )
        ],
        ephemeral: true
    });
}

function buildDatabasePanel(staff, owner) {
    const data = {
        'Search': can(staff, 'db.search', owner) ? 'Enabled' : 'Disabled',
        'Add Entries': can(staff, 'db.add', owner) ? 'Enabled' : 'Disabled',
        'Remove Entries': can(staff, 'db.remove', owner) ? 'Enabled' : 'Disabled',
        'Change Status': can(staff, 'db.status', owner) ? 'Enabled' : 'Disabled'
    };

    return createMessage({
        title: 'Staff - Global Database',
        data,
        color: COLORS.default,
        components: [
            createActionRow(
                createButton({ label: 'Search', customId: 'staff_db_search', style: 'primary', disabled: !can(staff, 'db.search', owner) }),
                createButton({ label: 'Add Entry', customId: 'staff_db_add', style: 'success', disabled: !can(staff, 'db.add', owner) }),
                createButton({ label: 'Remove Entry', customId: 'staff_db_remove', style: 'danger', disabled: !can(staff, 'db.remove', owner) })
            ),
            createActionRow(
                createButton({ label: 'Back', customId: 'staff_home', style: 'secondary' })
            )
        ],
        ephemeral: true
    });
}

async function buildReportsPanel(staff, owner) {
    const [open, today] = await Promise.all([
        SecurityReport.countDocuments({ status: 'open' }),
        SecurityReport.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } })
    ]);

    return createMessage({
        title: 'Staff - Security Reports',
        data: {
            Open: open,
            'Last 24 Hours': today,
            'View Permission': can(staff, 'report.view', owner) ? 'Enabled' : 'Disabled',
            'Investigate Permission': can(staff, 'report.investigate', owner) ? 'Enabled' : 'Disabled',
            'Resolve Permission': can(staff, 'report.resolve', owner) ? 'Enabled' : 'Disabled'
        },
        color: COLORS.danger,
        components: [
            createActionRow(
                createButton({ label: 'Open Reports', customId: 'staff_reports_open', style: 'primary', disabled: !can(staff, 'report.view', owner) }),
                createButton({ label: 'Refresh', customId: 'staff_reports', style: 'secondary' })
            ),
            createActionRow(createButton({ label: 'Back', customId: 'staff_home', style: 'secondary' }))
        ],
        ephemeral: true
    });
}

function buildPermissionPanel(staff, owner) {
    return createMessage({
        title: 'Staff - My Permissions',
        data: {
            'Database Search': can(staff, 'db.search', owner) ? 'Allowed' : 'Denied',
            'Database View': can(staff, 'db.view', owner) ? 'Allowed' : 'Denied',
            'Database Add': can(staff, 'db.add', owner) ? 'Allowed' : 'Denied',
            'Database Edit': can(staff, 'db.edit', owner) ? 'Allowed' : 'Denied',
            'Database Remove': can(staff, 'db.remove', owner) ? 'Allowed' : 'Denied',
            'Database Status': can(staff, 'db.status', owner) ? 'Allowed' : 'Denied',
            'Report View': can(staff, 'report.view', owner) ? 'Allowed' : 'Denied',
            'Report Investigate': can(staff, 'report.investigate', owner) ? 'Allowed' : 'Denied',
            'Report Resolve': can(staff, 'report.resolve', owner) ? 'Allowed' : 'Denied'
        },
        color: COLORS.default,
        components: [createActionRow(createButton({ label: 'Back', customId: 'staff_home', style: 'secondary' }))],
        ephemeral: true
    });
}

function modal(customId, title, fields) {
    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle(title)
        .addComponents(...fields.map(({ id, label, style = TextInputStyle.Short, required = true, placeholder }) =>
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setPlaceholder(placeholder || '')
            )
        ));
}

async function handleStaffPanel(interaction) {
    const owner = interaction.user.id === process.env.OWNER_ID;
    const staff = await getStaff(interaction.user.id);
    if (!owner && !staff) {
        return interaction.reply({ content: 'You are not trusted staff.', flags: MessageFlags.Ephemeral });
    }

    const id = interaction.customId;

    if (id === 'staff_home') return interaction.update(await staffPanel(interaction, staff));
    if (id === 'staff_database') {
        if (!can(staff, 'db.view', owner)) return interaction.reply({ content: 'You do not have database access.', flags: MessageFlags.Ephemeral });
        return interaction.update(buildDatabasePanel(staff, owner));
    }
    if (id === 'staff_reports') {
        if (!can(staff, 'report.view', owner)) return interaction.reply({ content: 'You do not have report access.', flags: MessageFlags.Ephemeral });
        return interaction.update(await buildReportsPanel(staff, owner));
    }
    if (id === 'staff_permissions') return interaction.update(buildPermissionPanel(staff, owner));

    if (id === 'staff_db_search') {
        if (!can(staff, 'db.search', owner)) return interaction.reply({ content: 'You do not have search permission.', flags: MessageFlags.Ephemeral });
        return interaction.showModal(modal('staff_modal_search', 'Search Global Database', [
            { id: 'id', label: 'Discord ID', placeholder: '123456789012345678' }
        ]));
    }

    if (id === 'staff_db_add') {
        if (!can(staff, 'db.add', owner)) return interaction.reply({ content: 'You do not have add permission.', flags: MessageFlags.Ephemeral });
        return interaction.showModal(modal('staff_modal_add', 'Add Global Database Entry', [
            { id: 'id', label: 'Discord ID', placeholder: '123456789012345678' },
            { id: 'type', label: 'Type: user or bot', placeholder: 'user' },
            { id: 'status', label: 'Status: trusted, suspicious, blacklisted', placeholder: 'blacklisted' },
            { id: 'reason', label: 'Reason', style: TextInputStyle.Paragraph, placeholder: 'Why this entry is being added' }
        ]));
    }

    if (id === 'staff_db_remove') {
        if (!can(staff, 'db.remove', owner)) return interaction.reply({ content: 'You do not have remove permission.', flags: MessageFlags.Ephemeral });
        return interaction.showModal(modal('staff_modal_remove', 'Remove Global Database Entry', [
            { id: 'id', label: 'Discord ID', placeholder: '123456789012345678' }
        ]));
    }

    if (id === 'staff_reports_open') {
        const reports = await SecurityReport.find({ status: 'open' }).sort({ createdAt: -1 }).limit(25).lean();
        if (!reports.length) {
            return interaction.update(createMessage({
                title: 'Staff - Open Reports',
                data: { Status: 'No open reports.' },
                color: COLORS.success,
                components: [createActionRow(createButton({ label: 'Back', customId: 'staff_reports', style: 'secondary' }))],
                ephemeral: true
            }));
        }
        const menu = new StringSelectMenuBuilder()
            .setCustomId('staff_report_pick')
            .setPlaceholder('Select an open report')
            .addOptions(reports.map(r => ({
                label: `${String(r.kind || 'report').slice(0, 60)} - ${String(r.reportId).slice(0, 30)}`,
                value: r.reportId,
                description: `${String(r.guildName || r.guildId || 'Unknown server').slice(0, 90)}`
            })));
        return interaction.update(createMessage({
            title: 'Staff - Open Reports',
            data: { Reports: `${reports.length} shown` },
            color: COLORS.danger,
            components: [
                new ActionRowBuilder().addComponents(menu),
                createActionRow(createButton({ label: 'Back', customId: 'staff_reports', style: 'secondary' }))
            ],
            ephemeral: true
        }));
    }

    if (id.startsWith('staff_report_pick')) return handleStaffReportPick(interaction);

    return interaction.reply({ content: 'Unknown staff action.', flags: MessageFlags.Ephemeral });
}

async function handleStaffSelect(interaction) {
    if (interaction.customId !== 'staff_report_pick') return false;
    const staff = await getStaff(interaction.user.id);
    const owner = interaction.user.id === process.env.OWNER_ID;
    if (!owner && !staff) {
        await interaction.reply({ content: 'You are not trusted staff.', flags: MessageFlags.Ephemeral });
        return true;
    }
    return handleStaffReportPick(interaction);
}

async function handleStaffReportPick(interaction) {
    if (!(await hasGlobalPermission(interaction.user.id, 'report.view'))) {
        return interaction.reply({ content: 'You do not have permission to view reports.', flags: MessageFlags.Ephemeral });
    }
    const reportId = interaction.values?.[0];
    const report = await SecurityReport.findOne({ reportId });
    if (!report) return interaction.reply({ content: 'Report not found.', flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
        .setTitle(`Security Report - ${report.kind}`)
        .setColor(COLORS.danger)
        .addFields(
            { name: 'Report ID', value: report.reportId, inline: true },
            { name: 'Status', value: report.status, inline: true },
            { name: 'Server', value: `${report.guildName || 'Unknown'} (${report.guildId || '-'})`, inline: false },
            { name: 'Target', value: report.targetTag ? `${report.targetTag} (${report.targetId || '-'})` : (report.targetId || '-'), inline: false },
            { name: 'Action', value: report.action || '-', inline: true },
            { name: 'Reason', value: report.reason || '-', inline: true }
        )
        .setTimestamp(report.createdAt || new Date());

    const buttons = new ActionRowBuilder().addComponents(
        createButton({ label: 'Investigate', customId: `report_investigate_${report.reportId}`, style: 'primary', disabled: !(await hasGlobalPermission(interaction.user.id, 'report.investigate')) }),
        createButton({ label: 'Resolve', customId: `report_resolve_${report.reportId}`, style: 'success', disabled: !(await hasGlobalPermission(interaction.user.id, 'report.resolve')) }),
        createButton({ label: 'Ignore', customId: `report_ignore_${report.reportId}`, style: 'secondary', disabled: !(await hasGlobalPermission(interaction.user.id, 'report.resolve')) })
    );

    return interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

async function handleStaffModal(interaction) {
    const owner = interaction.user.id === process.env.OWNER_ID;
    const staff = await getStaff(interaction.user.id);
    if (!owner && !staff) return interaction.reply({ content: 'You are not trusted staff.', flags: MessageFlags.Ephemeral });

    const id = interaction.fields.getTextInputValue('id').trim();
    if (!/^\d{17,20}$/.test(id)) return interaction.reply({ content: 'Invalid Discord ID.', flags: MessageFlags.Ephemeral });

    if (interaction.customId === 'staff_modal_search') {
        if (!can(staff, 'db.search', owner)) return interaction.reply({ content: 'You do not have search permission.', flags: MessageFlags.Ephemeral });
        const entry = await GlobalEntry.findOne({ discordId: id, active: true });
        return interaction.reply(entry ? createMessage({
            title: 'Database Result',
            data: { ID: entry.discordId, Type: entry.type, Status: entry.status, Reason: entry.reason, 'Added By': `<@${entry.addedBy}>` },
            color: entry.status === 'blacklisted' ? COLORS.danger : COLORS.default,
            ephemeral: true
        }) : createMessage({
            title: 'Database Result',
            data: { Status: 'Not Found', ID: id, Message: 'This ID is not currently in the global database.' },
            color: COLORS.warning,
            ephemeral: true
        }));
    }

    if (interaction.customId === 'staff_modal_add') {
        if (!can(staff, 'db.add', owner)) return interaction.reply({ content: 'You do not have add permission.', flags: MessageFlags.Ephemeral });
        const type = interaction.fields.getTextInputValue('type').trim().toLowerCase();
        const status = interaction.fields.getTextInputValue('status').trim().toLowerCase();
        const reason = interaction.fields.getTextInputValue('reason').trim();
        if (!['user', 'bot'].includes(type)) return interaction.reply({ content: 'Type must be user or bot.', flags: MessageFlags.Ephemeral });
        if (!['trusted', 'suspicious', 'blacklisted'].includes(status)) return interaction.reply({ content: 'Status must be trusted, suspicious, or blacklisted.', flags: MessageFlags.Ephemeral });
        const entry = await GlobalEntry.findOne({ discordId: id });
        const action = entry?.active ? 'UPDATE' : 'ADD';
        if (entry) {
            entry.type = type;
            entry.status = status;
            entry.reason = reason || 'No reason provided';
            entry.updatedBy = interaction.user.id;
            entry.active = true;
            await entry.save();
        } else {
            await GlobalEntry.create({ discordId: id, type, status, reason: reason || 'No reason provided', addedBy: interaction.user.id, updatedBy: interaction.user.id, active: true });
        }
        const { auditDatabase } = require('./ownerConfig.js');
        await auditDatabase({ action, discordId: id, type, status, reason: reason || 'No reason provided', actorId: interaction.user.id, sourceGuildId: interaction.guildId });
        return interaction.reply(createMessage({ title: action === 'ADD' ? 'Database Entry Added' : 'Database Entry Updated', data: { ID: id, Type: type, Status: status, Reason: reason || 'No reason provided' }, color: COLORS.success, ephemeral: true }));
    }

    if (interaction.customId === 'staff_modal_remove') {
        if (!can(staff, 'db.remove', owner)) return interaction.reply({ content: 'You do not have remove permission.', flags: MessageFlags.Ephemeral });
        const entry = await GlobalEntry.findOne({ discordId: id, active: true });
        if (!entry) return interaction.reply(createMessage({ title: 'Not Found', data: { ID: id, Status: 'This ID is not active in the global database.' }, color: COLORS.warning, ephemeral: true }));
        entry.active = false;
        entry.updatedBy = interaction.user.id;
        await entry.save();
        const { auditDatabase } = require('./ownerConfig.js');
        await auditDatabase({ action: 'REMOVE', discordId: id, type: entry.type, status: entry.status, reason: entry.reason, actorId: interaction.user.id, sourceGuildId: interaction.guildId });
        return interaction.reply(createMessage({ title: 'Database Entry Removed', data: { ID: id, 'Previous Type': entry.type, 'Previous Status': entry.status }, color: COLORS.success, ephemeral: true }));
    }

    return interaction.reply({ content: 'Unknown staff form.', flags: MessageFlags.Ephemeral });
}

module.exports = { staffPanel, handleStaffPanel, handleStaffSelect, handleStaffModal };
