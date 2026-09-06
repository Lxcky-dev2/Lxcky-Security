"use strict";

const { createMessage, createActionRow, createButton, createSelectMenu, COLORS } = require('./componentBuilder.js');
const { getGuildSettings } = require('./securityPanels.js');

function buildSettingsPanel(settings, guild) {
    const channels = guild.channels.cache.filter(c => c.type === 0)
        .map(c => ({ label: `#${c.name}`, value: c.id, description: c.id }));
    if (!channels.length) channels.push({ label: 'No text channels found', value: 'none' });

    return createMessage({
        title: 'Server Settings - lxcky Security',
        data: {
            Server: settings.guildName,
            'Mod Logs': settings.logChannelId ? `<#${settings.logChannelId}>` : 'Not Set',
            'Alert Logs': settings.alertChannelId ? `<#${settings.alertChannelId}>` : 'Not Set',
            'Member Logs': settings.memberLogChannelId ? `<#${settings.memberLogChannelId}>` : 'Not Set',
            'Message Logs': settings.messageLogChannelId ? `<#${settings.messageLogChannelId}>` : 'Not Set',
            'Audit Logs': settings.auditLogChannelId ? `<#${settings.auditLogChannelId}>` : 'Not Set',
            'Verify Logs': settings.verifyLogChannelId ? `<#${settings.verifyLogChannelId}>` : 'Not Set'
        },
        color: COLORS.default,
        components: [
            createActionRow(createSelectMenu({ customId: 'settings_select_channel', placeholder: 'Select a channel...', options: channels.slice(0,25) })),
            createActionRow(
                createButton({ label: 'Assign Mod Logs', customId: 'assign_modlogs', style: 'primary' }),
                createButton({ label: 'Assign Alert Logs', customId: 'assign_alerts', style: 'primary' }),
                createButton({ label: 'Assign Member Logs', customId: 'assign_members', style: 'secondary' })
            ),
            createActionRow(
                createButton({ label: 'Assign Message Logs', customId: 'assign_messages', style: 'secondary' }),
                createButton({ label: 'Assign Audit Logs', customId: 'assign_audit', style: 'secondary' }),
                createButton({ label: 'Assign Verify Logs', customId: 'assign_verify', style: 'success' })
            ),
            createActionRow(
                createButton({ label: 'Clear Log Channels', customId: 'settings_clear_all', style: 'danger' }),
                createButton({ label: 'Refresh', customId: 'settings_refresh', style: 'secondary' })
            )
        ],
        footer: 'Select a channel, then assign it to a log type.',
        ephemeral: true
    });
}

const selectedChannelCache = new Map();

async function handleSettingsPanel(interaction) {
    const customId = interaction.customId;
    const settings = await getGuildSettings(interaction.guildId);
    const guild = interaction.guild;

    if (customId === 'settings_refresh') return interaction.update(buildSettingsPanel(settings, guild));
    if (customId === 'settings_select_channel') {
        selectedChannelCache.set(interaction.user.id, interaction.values[0]);
        return interaction.reply({ content: `Selected <#${interaction.values[0]}>. Choose an assignment button.`, flags: 64 });
    }
    if (customId === 'settings_clear_all') {
        for (const key of ['logChannelId','alertChannelId','memberLogChannelId','messageLogChannelId','auditLogChannelId','verifyLogChannelId']) settings[key] = null;
        await settings.save();
        return interaction.update(buildSettingsPanel(settings, guild));
    }

    const assignMap = {
        assign_modlogs: 'logChannelId', assign_alerts: 'alertChannelId', assign_members: 'memberLogChannelId',
        assign_messages: 'messageLogChannelId', assign_audit: 'auditLogChannelId', assign_verify: 'verifyLogChannelId'
    };
    const key = assignMap[customId];
    if (!key) return;
    const channelId = selectedChannelCache.get(interaction.user.id);
    if (!channelId || channelId === 'none') return interaction.reply({ content: 'Select a channel first.', flags: 64 });
    settings[key] = channelId;
    await settings.save();
    selectedChannelCache.delete(interaction.user.id);
    return interaction.update(buildSettingsPanel(settings, guild));
}

module.exports = { buildSettingsPanel, handleSettingsPanel };
