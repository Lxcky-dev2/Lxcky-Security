"use strict";

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

// Discord's own palette, so panels sit naturally alongside native UI.
const COLORS = {
  default: 0x5865F2,
  success: 0x57F287,
  danger: 0xED4245,
  warning: 0xFEE75C
};

function divider(spacing = SeparatorSpacingSize.Small) {
  return new SeparatorBuilder().setDivider(true).setSpacing(spacing);
}

function formatEntries(data) {
  return Object.entries(data)
    .map(([label, value]) => `**${label}:** ${value}`)
    .join('\n');
}

function createButton({ label, customId, style = 'primary', disabled = false, url = null }) {
  const styleMap = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
    link: ButtonStyle.Link
  };
  const buttonStyle = styleMap[style.toLowerCase()] || ButtonStyle.Primary;

  const button = new ButtonBuilder()
    .setLabel(label)
    .setStyle(buttonStyle)
    .setDisabled(disabled);

  if (url && buttonStyle === ButtonStyle.Link) button.setURL(url);
  else button.setCustomId(customId);

  return button;
}

function createActionRow(...components) {
  return new ActionRowBuilder().addComponents(...components);
}

function createSelectMenu({ customId, placeholder, minValues = 1, maxValues = 1, options = [] }) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(minValues)
    .setMaxValues(maxValues);

  select.addOptions(options.map(opt => ({
    label: opt.label,
    value: opt.value,
    description: opt.description
  })));

  return select;
}

function createMessage({ title, data = {}, color = COLORS.default, components = [], footer = null, ephemeral = false }) {
  const container = new ContainerBuilder().setAccentColor(color);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${title}`)
  );

  if (data && Object.keys(data).length > 0) {
    container.addSeparatorComponents(divider());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(formatEntries(data))
    );
  }

  for (const row of components) {
    container.addSeparatorComponents(divider());
    container.addActionRowComponents(row);
  }

  if (footer) {
    container.addSeparatorComponents(divider(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footer}`)
    );
  }

  const flags = ephemeral
    ? [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    : MessageFlags.IsComponentsV2;

  return { components: [container], flags };
}

module.exports = {
  COLORS,
  divider,
  formatEntries,
  createButton,
  createActionRow,
  createSelectMenu,
  createMessage
};