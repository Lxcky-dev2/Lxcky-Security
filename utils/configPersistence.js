"use strict";

const GuildSettings = require('../db/models/GuildSettings.js');
const OwnerConfig = require('../db/models/OwnerConfig.js');
const TicketConfig = require('../db/models/TicketConfig.js');
const WelcomeConfig = require('../db/models/WelcomeConfig.js');
const VerificationConfig = require('../db/models/VerificationConfig.js');
const AutoModConfig = require('../db/models/AutoModConfig.js');

async function ensureGuildConfig(guild) {
  if (!guild?.id) return null;
  const settings = await GuildSettings.findOneAndUpdate(
    { guildId: guild.id },
    { $set: { guildName: guild.name }, $setOnInsert: { guildId: guild.id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return settings;
}

async function ensureFeatureConfigs(guild) {
  if (!guild?.id) return;
  await Promise.all([
    TicketConfig.updateOne(
      { guildId: guild.id },
      { $setOnInsert: { guildId: guild.id } },
      { upsert: true, setDefaultsOnInsert: true }
    ),
    WelcomeConfig.updateOne(
      { guildId: guild.id },
      { $setOnInsert: { guildId: guild.id } },
      { upsert: true, setDefaultsOnInsert: true }
    ),
    VerificationConfig.updateOne(
      { guildId: guild.id },
      { $setOnInsert: { guildId: guild.id } },
      { upsert: true, setDefaultsOnInsert: true }
    ),
    AutoModConfig.updateOne(
      { guildId: guild.id },
      { $setOnInsert: { guildId: guild.id } },
      { upsert: true, setDefaultsOnInsert: true }
    )
  ]);
}

async function ensureAllGuildConfigs(client) {
  if (!client?.guilds?.cache) return;
  for (const guild of client.guilds.cache.values()) {
    await ensureGuildConfig(guild);
    await ensureFeatureConfigs(guild);
  }
}

async function ensureOwnerConfig() {
  return OwnerConfig.findOneAndUpdate(
    { key: 'owner' },
    { $setOnInsert: { key: 'owner' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  ensureGuildConfig,
  ensureFeatureConfigs,
  ensureAllGuildConfigs,
  ensureOwnerConfig
};
