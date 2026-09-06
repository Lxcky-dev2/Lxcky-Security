"use strict";

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    ModalBuilder,
    RoleSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const TicketConfig = require('../db/models/TicketConfig.js');
const Ticket = require('../db/models/Ticket.js');
const { MessageFlags } = require('discord.js');
const { hasPermission } = require('./permissionChecker.js');

async function getTicketConfig(guildId) {
    let cfg = await TicketConfig.findOne({ guildId });
    if (!cfg) cfg = await TicketConfig.create({ guildId });
    if (!Array.isArray(cfg.panelButtons) || !cfg.panelButtons.length) {
        cfg.panelButtons = [{ label: 'Support', key: 'support', description: 'Open a general support ticket', name: 'Support', enabled: true }];
        await cfg.save();
    }
    return cfg;
}

function replaceTemplate(template, member, type) {
    return String(template || '{type}-{username}')
        .replaceAll('{type}', type.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-'))
        .replaceAll('{username}', member.user.username.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-'))
        .replaceAll('{userid}', member.id)
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 90) || `ticket-${member.id}`;
}

function ticketSetupPanel(cfg, guild) {
    const channels = {
        'Panel Channel': cfg.panelChannelId ? `<#${cfg.panelChannelId}>` : 'Not set',
        'Ticket Category': cfg.categoryId ? `<#${cfg.categoryId}>` : 'Not set',
        'Audit Channel': cfg.auditChannelId ? `<#${cfg.auditChannelId}>` : 'Not set',
        'Staff Role': cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : 'Not set'
    };

    return {
        embeds: [new EmbedBuilder()
            .setTitle('Ticket Setup')
            .setDescription(`Configuration for ${guild.name}`)
            .addFields(
                ...Object.entries(channels).map(([name, value]) => ({ name, value, inline: true })),
                { name: 'Ticket Name', value: `\`${cfg.ticketNameTemplate}\``, inline: true },
                { name: 'Buttons', value: `${cfg.panelButtons.filter(b => b.enabled).length}`, inline: true },
                { name: 'Enabled', value: cfg.enabled ? 'Yes' : 'No', inline: true }
            )],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_cfg_channels').setLabel('Channels').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_cfg_content').setLabel('Panel Content').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket_cfg_buttons').setLabel('Ticket Buttons').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_cfg_name').setLabel('Ticket Naming').setStyle(ButtonStyle.Secondary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_cfg_toggle').setLabel(cfg.enabled ? 'Disable Tickets' : 'Enable Tickets').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket_cfg_preview').setLabel('Preview Panel').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket_cfg_post').setLabel('Post Panel').setStyle(ButtonStyle.Success)
            )
        ],
        flags: MessageFlags.Ephemeral
    };
}

function channelsPanel(cfg) {
    return {
        embeds: [new EmbedBuilder().setTitle('Ticket Channels').setDescription('Choose where ticket messages and logs should go.')],
        components: [
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('ticket_channel_panel')
                    .setPlaceholder('Select the ticket panel channel')
                    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                    .setMinValues(1).setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('ticket_channel_category')
                    .setPlaceholder('Select the ticket category')
                    .setChannelTypes(ChannelType.GuildCategory)
                    .setMinValues(1).setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('ticket_channel_audit')
                    .setPlaceholder('Select the ticket audit channel')
                    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                    .setMinValues(1).setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('ticket_role_staff')
                    .setPlaceholder('Select the ticket staff role')
                    .setMinValues(1).setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_cfg_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
            )
        ],
        flags: MessageFlags.Ephemeral
    };
}

function showModal(customId, title, fields) {
    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle(title)
        .addComponents(...fields.map(f => new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(f.id)
                .setLabel(f.label)
                .setStyle(f.style || TextInputStyle.Short)
                .setRequired(f.required ?? true)
                .setMaxLength(f.maxLength || 4000)
                .setPlaceholder(f.placeholder || '')
                .setValue(f.value || '')
        )));
}

async function handleTicketCommand(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'Tickets can only be configured in a server.', flags: MessageFlags.Ephemeral });
    if (!(await hasPermission(interaction.member, 'manageGuild'))) return interaction.reply({ content: 'Manage Server permission is required.', flags: MessageFlags.Ephemeral });

    const cfg = await getTicketConfig(interaction.guildId);
    if (interaction.options.getSubcommand() === 'setup') {
        return interaction.reply(ticketSetupPanel(cfg, interaction.guild));
    }

    if (interaction.options.getSubcommand() === 'panel') {
        return interaction.reply(await buildTicketPanel(interaction.guild));
    }
}

async function buildTicketPanel(guild) {
    const cfg = await getTicketConfig(guild.id);
    const buttons = cfg.panelButtons.filter(b => b.enabled).slice(0, 25);
    const rows = [];
    let row = null;
    for (const button of buttons) {
        if (!row || row.components.length >= 5) {
            row = new ActionRowBuilder();
            rows.push(row);
        }
        row.addComponents(new ButtonBuilder()
            .setCustomId(`ticket_open_${button.key}`)
            .setLabel(button.label)
            .setStyle(ButtonStyle.Primary));
    }

    return {
        embeds: [new EmbedBuilder().setTitle(cfg.panelTitle).setDescription(cfg.panelDescription)],
        components: rows
    };
}

async function sendAudit(guild, cfg, action, ticket, actorId) {
    if (!cfg.auditChannelId) return;
    const channel = guild.channels.cache.get(cfg.auditChannelId);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder()
        .setTitle('Ticket Audit')
        .addFields(
            { name: 'Action', value: action, inline: true },
            { name: 'Ticket', value: `#${ticket.ticketName}`, inline: true },
            { name: 'User', value: `<@${ticket.userId}> (${ticket.userId})`, inline: false },
            { name: 'Ticket Type', value: ticket.ticketType, inline: true },
            { name: 'Channel', value: `<#${ticket.channelId}>`, inline: true },
            { name: 'Actor', value: `<@${actorId}>`, inline: true }
        )
        .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(err => console.error('[TICKETS] Audit send failed:', err));
}

async function openTicket(interaction, typeKey) {
    const cfg = await getTicketConfig(interaction.guildId);
    if (!cfg.enabled) return interaction.reply({ content: 'Tickets are currently disabled.', flags: MessageFlags.Ephemeral });

    const button = cfg.panelButtons.find(b => b.enabled && b.key === typeKey);
    if (!button) return interaction.reply({ content: 'That ticket type is no longer available.', flags: MessageFlags.Ephemeral });

    const existing = await Ticket.findOne({ guildId: interaction.guildId, userId: interaction.user.id, status: 'open' });
    if (existing) {
        return interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>`, flags: MessageFlags.Ephemeral });
    }

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = interaction.member;
    const channelName = replaceTemplate(cfg.ticketNameTemplate, member, button.name || button.label);
    const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
        { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'ManageMessages'] }
    ];
    if (cfg.staffRoleId) {
        overwrites.push({ id: cfg.staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] });
    }

    const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: cfg.categoryId || undefined,
        permissionOverwrites: overwrites,
        topic: `Ticket for ${interaction.user.id} | Type: ${button.key}`
    });

    const ticket = await Ticket.create({
        guildId: interaction.guildId,
        channelId: channel.id,
        userId: interaction.user.id,
        ticketType: button.key,
        ticketName: channelName
    });

    const closeLabel = cfg.closeButtonLabel || 'Close Ticket';
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel(closeLabel).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Secondary)
    );
    await channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [new EmbedBuilder().setTitle(`${button.name || button.label} Ticket`).setDescription('A member of the support team will be with you shortly.').addFields({ name: 'Opened By', value: `<@${interaction.user.id}>` })],
        components: [row]
    });
    await sendAudit(interaction.guild, cfg, 'Ticket Opened', ticket, interaction.user.id);
    return interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });
}

async function closeTicket(interaction) {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
    if (!ticket) return interaction.reply({ content: 'This channel is not an open ticket.', flags: MessageFlags.Ephemeral });

    const cfg = await getTicketConfig(interaction.guildId);
    const memberIsOwner = ticket.userId === interaction.user.id;
    const staffAllowed = cfg.staffRoleId && interaction.member.roles?.cache?.has(cfg.staffRoleId);
    const canClose = memberIsOwner || staffAllowed || interaction.memberPermissions?.has('Administrator');
    if (!canClose) return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = interaction.user.id;
    await ticket.save();
    await sendAudit(interaction.guild, cfg, 'Ticket Closed', ticket, interaction.user.id);

    await interaction.reply({ content: 'This ticket will be closed.', flags: MessageFlags.Ephemeral });
    setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 1500);
}

async function claimTicket(interaction) {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
    if (!ticket) return interaction.reply({ content: 'This is not an open ticket.', flags: MessageFlags.Ephemeral });
    const cfg = await getTicketConfig(interaction.guildId);
    const allowed = (cfg.staffRoleId && interaction.member.roles?.cache?.has(cfg.staffRoleId)) || interaction.memberPermissions?.has('Administrator');
    if (!allowed) return interaction.reply({ content: 'Only ticket staff can claim tickets.', flags: MessageFlags.Ephemeral });
    ticket.claimedBy = interaction.user.id;
    await ticket.save();
    await interaction.reply({ content: `This ticket has been claimed by <@${interaction.user.id}>.` });
    await sendAudit(interaction.guild, cfg, 'Ticket Claimed', ticket, interaction.user.id);
}

async function handleTicketComponent(interaction) {
    const configInteraction = interaction.customId.startsWith('ticket_cfg_') ||
        interaction.customId.startsWith('ticket_channel_') ||
        interaction.customId === 'ticket_role_staff' ||
        interaction.customId.startsWith('ticket_modal_');

    if (configInteraction && !(await hasPermission(interaction.member, 'manageGuild'))) {
        return interaction.reply({ content: 'Manage Server permission is required for ticket configuration.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.isChannelSelectMenu()) {
        const cfg = await getTicketConfig(interaction.guildId);
        if (interaction.customId === 'ticket_channel_panel') cfg.panelChannelId = interaction.values[0];
        else if (interaction.customId === 'ticket_channel_category') cfg.categoryId = interaction.values[0];
        else if (interaction.customId === 'ticket_channel_audit') cfg.auditChannelId = interaction.values[0];
        else return;
        await cfg.save();
        return interaction.update(channelsPanel(cfg));
    }

    if (interaction.isRoleSelectMenu() && interaction.customId === 'ticket_role_staff') {
        const cfg = await getTicketConfig(interaction.guildId);
        cfg.staffRoleId = interaction.values[0];
        await cfg.save();
        return interaction.update(channelsPanel(cfg));
    }

    if (interaction.isModalSubmit()) {
        const cfg = await getTicketConfig(interaction.guildId);
        if (interaction.customId === 'ticket_modal_content') {
            cfg.panelTitle = interaction.fields.getTextInputValue('title').trim() || 'Support Tickets';
            cfg.panelDescription = interaction.fields.getTextInputValue('description').trim() || 'Select a ticket type below to open a private support ticket.';
            await cfg.save();
            return interaction.reply(ticketSetupPanel(cfg, interaction.guild));
        }
        if (interaction.customId === 'ticket_modal_name') {
            cfg.ticketNameTemplate = interaction.fields.getTextInputValue('template').trim() || '{type}-{username}';
            cfg.closeButtonLabel = interaction.fields.getTextInputValue('close').trim() || 'Close Ticket';
            await cfg.save();
            return interaction.reply(ticketSetupPanel(cfg, interaction.guild));
        }
        if (interaction.customId === 'ticket_modal_buttons') {
            const raw = interaction.fields.getTextInputValue('buttons');
            const parsed = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 5).map((line, index) => {
                const parts = line.split('|').map(p => p.trim());
                const label = parts[0] || `Ticket ${index + 1}`;
                const key = (parts[1] || label.toLowerCase()).replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || `ticket${index + 1}`;
                const description = parts[2] || '';
                return { label: label.slice(0, 80), key, description: description.slice(0, 100), name: label.slice(0, 80), enabled: true };
            });
            if (!parsed.length) return interaction.reply({ content: 'Add at least one ticket button.', flags: MessageFlags.Ephemeral });
            const seen = new Set();
            cfg.panelButtons = parsed.filter(b => !seen.has(b.key) && (seen.add(b.key), true));
            await cfg.save();
            return interaction.reply(ticketSetupPanel(cfg, interaction.guild));
        }
    }

    if (interaction.isButton()) {
        const id = interaction.customId;
        if (id === 'ticket_cfg_back') {
            const cfg = await getTicketConfig(interaction.guildId);
            return interaction.update(ticketSetupPanel(cfg, interaction.guild));
        }
        if (id === 'ticket_cfg_channels') {
            const cfg = await getTicketConfig(interaction.guildId);
            return interaction.update(channelsPanel(cfg));
        }
        if (id === 'ticket_cfg_content') {
            const cfg = await getTicketConfig(interaction.guildId);
            return interaction.showModal(showModal('ticket_modal_content', 'Ticket Panel Content', [
                { id: 'title', label: 'Panel Title', value: cfg.panelTitle, maxLength: 256 },
                { id: 'description', label: 'Panel Description', value: cfg.panelDescription, style: TextInputStyle.Paragraph, maxLength: 4000 }
            ]));
        }
        if (id === 'ticket_cfg_name') {
            const cfg = await getTicketConfig(interaction.guildId);
            return interaction.showModal(showModal('ticket_modal_name', 'Ticket Naming', [
                { id: 'template', label: 'Ticket Name Template', value: cfg.ticketNameTemplate, placeholder: '{type}-{username}' },
                { id: 'close', label: 'Close Button Label', value: cfg.closeButtonLabel, placeholder: 'Close Ticket' }
            ]));
        }
        if (id === 'ticket_cfg_buttons') {
            const cfg = await getTicketConfig(interaction.guildId);
            const value = cfg.panelButtons.map(b => `${b.label} | ${b.key} | ${b.description || ''}`).join('\n');
            return interaction.showModal(showModal('ticket_modal_buttons', 'Ticket Buttons', [
                { id: 'buttons', label: 'One button per line', value, style: TextInputStyle.Paragraph, maxLength: 2000, placeholder: 'Support | support | General support' }
            ]));
        }
        if (id === 'ticket_cfg_toggle') {
            const cfg = await getTicketConfig(interaction.guildId);
            cfg.enabled = !cfg.enabled;
            await cfg.save();
            return interaction.update(ticketSetupPanel(cfg, interaction.guild));
        }
        if (id === 'ticket_cfg_preview') return interaction.update(await buildTicketPanel(interaction.guild));
        if (id === 'ticket_cfg_post') {
            const cfg = await getTicketConfig(interaction.guildId);
            if (!cfg.panelChannelId) return interaction.reply({ content: 'Set the panel channel first.', flags: MessageFlags.Ephemeral });
            if (!cfg.categoryId) return interaction.reply({ content: 'Set the ticket category first.', flags: MessageFlags.Ephemeral });
            const channel = interaction.guild.channels.cache.get(cfg.panelChannelId);
            if (!channel?.isTextBased()) return interaction.reply({ content: 'The configured panel channel is invalid.', flags: MessageFlags.Ephemeral });
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            try {
                await channel.send(await buildTicketPanel(interaction.guild));
                return interaction.editReply({ content: `Ticket panel posted in <#${channel.id}>.` });
            } catch (error) {
                console.error('[TICKETS] Panel post failed:', error);
                return interaction.editReply({ content: 'Failed to post the ticket panel.' });
            }
        }
        if (id === 'ticket_close') return closeTicket(interaction);
        if (id === 'ticket_claim') return claimTicket(interaction);
        if (id.startsWith('ticket_open_')) return openTicket(interaction, id.slice('ticket_open_'.length));
    }
}

module.exports = {
    getTicketConfig,
    handleTicketCommand,
    handleTicketComponent,
    buildTicketPanel,
    ticketSetupPanel
};
