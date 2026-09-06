"use strict";

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType
} = require('discord.js');
const AutoModConfig = require('../db/models/AutoModConfig.js');
const { hasPermission } = require('./permissionChecker.js');
const { logMessage } = require('./logger.js');

async function getConfig(guildId) {
  return AutoModConfig.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function buildPanel(cfg) {
  const embed = new EmbedBuilder()
    .setTitle('AutoMod')
    .setDescription('Configure automatic message protection.')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Enabled', value: cfg.enabled ? 'Yes' : 'No', inline: true },
      { name: 'Spam', value: cfg.spam ? 'On' : 'Off', inline: true },
      { name: 'Invites', value: cfg.invites ? 'On' : 'Off', inline: true },
      { name: 'Mentions', value: cfg.mentions ? 'On' : 'Off', inline: true },
      { name: 'Caps', value: cfg.caps ? 'On' : 'Off', inline: true },
      { name: 'Words', value: cfg.words ? 'On' : 'Off', inline: true },
      { name: 'Regex', value: cfg.regex ? 'On' : 'Off', inline: true },
      { name: 'Blocked Words', value: cfg.blockedWords.length ? cfg.blockedWords.slice(0, 15).join(', ') : 'None' },
      { name: 'Regex Rules', value: cfg.regexRules.length ? `${cfg.regexRules.length} configured` : 'None' },
      { name: 'Punishment', value: cfg.punishment }
    );

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_all').setLabel(cfg.enabled ? 'Disable AutoMod' : 'Enable AutoMod').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('automod_toggle_spam').setLabel(`Spam: ${cfg.spam ? 'On' : 'Off'}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('automod_toggle_invites').setLabel(`Invites: ${cfg.invites ? 'On' : 'Off'}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('automod_toggle_mentions').setLabel(`Mentions: ${cfg.mentions ? 'On' : 'Off'}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('automod_toggle_caps').setLabel(`Caps: ${cfg.caps ? 'On' : 'Off'}`).setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_words').setLabel(`Words: ${cfg.words ? 'On' : 'Off'}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('automod_toggle_regex').setLabel(`Regex: ${cfg.regex ? 'On' : 'Off'}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('automod_add_word').setLabel('Add Word').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('automod_add_regex').setLabel('Add Regex').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('automod_settings').setLabel('Rule Settings').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
    )
  ];

  return { embeds: [embed], components: rows, flags: MessageFlags.Ephemeral };
}

function bypass(message, cfg) {
  if (cfg.bypassChannelIds.includes(message.channel.id)) return true;
  return Boolean(message.member?.roles?.cache?.some(role => cfg.bypassRoleIds.includes(role.id)));
}

async function punish(message, cfg, reason) {
  await message.delete().catch(() => {});
  if (cfg.punishment === 'warn') {
    // Keep the punishment lightweight; the existing warning command/database can be used by staff for persistent cases.
  }
  if (cfg.punishment === 'timeout') {
    const ms = Math.min(Math.max(Number(cfg.timeoutMinutes || 5) * 60_000, 5_000), 2_419_200_000);
    await message.member?.timeout(ms, `AutoMod: ${reason}`).catch(() => {});
  }
  if (cfg.logChannelId) {
    await logMessage(global.client, message.guild.id, 'AutoMod Action', {
      User: `${message.author.tag} (${message.author.id})`,
      Channel: `<#${message.channel.id}>`,
      Reason: reason,
      Punishment: cfg.punishment
    }).catch(() => {});
  }
}

async function checkMessage(message) {
  if (!message.guild || message.author.bot || !message.content) return;
  const cfg = await getConfig(message.guild.id);
  if (!cfg.enabled || bypass(message, cfg)) return;

  const text = message.content;
  let reason = null;

  if (cfg.invites && /(discord\.gg\/|discord\.com\/invite\/)/i.test(text)) {
    reason = 'Invite link';
  }

  if (!reason && cfg.mentions) {
    const count = (text.match(/<@&?\d+>|@everyone|@here/g) || []).length;
    if (count >= Number(cfg.maxMentions || 8)) reason = 'Mention spam';
  }

  if (!reason && cfg.caps) {
    const letters = text.replace(/[^A-Za-z]/g, '');
    if (letters.length >= 10) {
      const upper = letters.replace(/[^A-Z]/g, '').length;
      if ((upper / letters.length) * 100 >= Number(cfg.capsPercent || 80)) reason = 'Excessive caps';
    }
  }

  if (!reason && cfg.words && cfg.blockedWords.some(word => word && text.toLowerCase().includes(word.toLowerCase()))) {
    reason = 'Blocked word';
  }

  if (!reason && cfg.regex) {
    for (const rule of cfg.regexRules) {
      try {
        if (new RegExp(rule, 'i').test(text)) {
          reason = 'Regex rule';
          break;
        }
      } catch (_) {}
    }
  }

  if (reason) await punish(message, cfg, reason);
}

async function handle(interaction) {
  if (!(await hasPermission(interaction.member, 'manageGuild'))) {
    return interaction.reply({ content: 'Manage Server permission is required.', flags: 64 });
  }
  return interaction.reply(await buildPanel(await getConfig(interaction.guildId)));
}

async function component(interaction) {
  if (!(await hasPermission(interaction.member, 'manageGuild'))) {
    return interaction.reply({ content: 'Manage Server permission is required.', flags: 64 });
  }

  const cfg = await getConfig(interaction.guildId);
  const id = interaction.customId;

  if (id === 'automod_refresh') return interaction.update(buildPanel(cfg));
  if (id === 'automod_toggle_all') cfg.enabled = !cfg.enabled;
  else if (id.startsWith('automod_toggle_')) {
    const key = id.replace('automod_toggle_', '');
    if (['spam', 'invites', 'mentions', 'caps', 'words', 'regex'].includes(key)) cfg[key] = !cfg[key];
  } else if (id === 'automod_add_word' || id === 'automod_add_regex') {
    const isRegex = id.endsWith('regex');
    const modal = new ModalBuilder().setCustomId(isRegex ? 'automod_regex_modal' : 'automod_word_modal').setTitle(isRegex ? 'Add Regex Rule' : 'Add Blocked Word');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('value').setLabel(isRegex ? 'Regular expression' : 'Word or phrase').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
    ));
    return interaction.showModal(modal);
  } else if (id === 'automod_settings') {
    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('AutoMod Settings').setDescription('Choose bypass roles and channels.').setColor(0x5865f2)],
      components: [
        new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('automod_bypass_roles').setPlaceholder('Select bypass roles').setMinValues(0).setMaxValues(25)),
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('automod_bypass_channels').setPlaceholder('Select bypass channels').setMinValues(0).setMaxValues(25).setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('automod_refresh').setLabel('Back').setStyle(ButtonStyle.Secondary))
      ],
      flags: 64
    });
  } else {
    await cfg.save();
    return interaction.update(buildPanel(cfg));
  }

  await cfg.save();
  return interaction.update(buildPanel(cfg));
}

async function modal(interaction) {
  if (!(await hasPermission(interaction.member, 'manageGuild'))) return interaction.reply({ content: 'Manage Server permission is required.', flags: 64 });
  const cfg = await getConfig(interaction.guildId);
  const value = interaction.fields.getTextInputValue('value').trim();
  if (!value) return interaction.reply({ content: 'A value is required.', flags: 64 });

  if (interaction.customId === 'automod_regex_modal') {
    try { new RegExp(value); } catch (_) { return interaction.reply({ content: 'That regex is invalid.', flags: 64 }); }
    if (!cfg.regexRules.includes(value)) cfg.regexRules.push(value);
    cfg.regex = true;
  } else {
    if (!cfg.blockedWords.includes(value)) cfg.blockedWords.push(value);
    cfg.words = true;
  }
  await cfg.save();
  return interaction.reply(buildPanel(cfg));
}

async function select(interaction) {
  if (!(await hasPermission(interaction.member, 'manageGuild'))) return interaction.reply({ content: 'Manage Server permission is required.', flags: 64 });
  const cfg = await getConfig(interaction.guildId);
  if (interaction.customId === 'automod_bypass_roles') cfg.bypassRoleIds = interaction.values || [];
  if (interaction.customId === 'automod_bypass_channels') cfg.bypassChannelIds = interaction.values || [];
  await cfg.save();
  return interaction.update(buildPanel(cfg));
}

module.exports = { getConfig, buildPanel, checkMessage, handle, component, modal, select };
