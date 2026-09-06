const { SlashCommandBuilder } = require('discord.js');
const Account = require('../db/Account');
const prism = require('../auth/prismarineAuth');
const xboxProfile = require('../auth/xboxProfile');
const xboxApi = require('../auth/xboxApi');
const { build } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder().setName('status').setDescription('Show linking status for your account.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const acc = await Account.findOne({ discordId: interaction.user.id });
    if (!acc) return interaction.editReply({ embeds: [build({ title: 'Status', description: 'No linked account found. Use /link to link.', color: 0xFACC15 })], ephemeral: true });
    try {
      const tokenData = await prism.refreshForProfile(acc.profileFolder);
      let profile = await xboxProfile.getProfile(acc.profileFolder).catch(() => null);
      // Try to enrich with xboxApi which may call Xbox endpoints if tokens are available
      const enriched = await xboxApi.getFullProfile(acc.profileFolder).catch(() => null);
      if (enriched) profile = { ...(profile || {}), ...enriched };

      const fields = [];
      if (profile?.gamertag) fields.push({ name: 'Gamertag', value: profile.gamertag, inline: true });
      if (profile?.playFabId) fields.push({ name: 'PlayFab ID', value: profile.playFabId, inline: true });
      if (profile?.xboxProfileUrl) fields.push({ name: 'Xbox Profile', value: profile.xboxProfileUrl, inline: false });

      const thumbnail = profile?.gamertag ? `https://avatar-ssl.xboxlive.com/avatar/${encodeURIComponent(profile.gamertag)}/avatarpic-l.png` : null;
      const footer = `Requested by ${interaction.user.tag}`;

      fields.push({ name: 'Token', value: `Expires in ~${Math.round((tokenData.expiresIn || 0)/60)} minutes.`, inline: false });

      return interaction.editReply({ embeds: [build({ title: profile?.gamertag ? `${profile.gamertag} — Account Status` : 'Linked Account Status', fields, color: 0x6C8CFF, thumbnail, footer })], ephemeral: true });
    } catch (err) {
      console.error('Status check failed', err);
      return interaction.editReply({ embeds: [build({ title: 'Status', description: 'Linked profile found but failed to refresh tokens. You may need to re-link.', color: 0xF43F5E })], ephemeral: true });
    }
  }
};
