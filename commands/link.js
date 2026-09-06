const { SlashCommandBuilder } = require('discord.js');
const prism = require('../auth/prismarineAuth');
const Account = require('../db/Account');

module.exports = {
  data: new SlashCommandBuilder().setName('link').setDescription('Link your Xbox account with this bot (device code flow).'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { folder, tokenData } = await prism.linkWithDeviceCode(interaction)

      // tokenData contains mcToken and other values; we persist the profile folder
      await Account.findOneAndUpdate(
        { discordId: interaction.user.id },
        { profileFolder: folder, expiresAt: new Date(Date.now() + (tokenData.expiresIn || 3600) * 1000) },
        { upsert: true, new: true }
      )

      return interaction.editReply('Account linked successfully.');
    } catch (err) {
      console.error('Link error', err);
      return interaction.editReply('Failed to start device-code auth.');
    }
  }
};
