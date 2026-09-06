const { SlashCommandBuilder } = require('discord.js');
const Account = require('../db/Account');

module.exports = {
  data: new SlashCommandBuilder().setName('unlink').setDescription('Unlink your account from the bot.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const doc = await Account.findOneAndDelete({ discordId: interaction.user.id });
    if (doc) {
      return interaction.editReply('Your account has been unlinked.');
    }
    return interaction.editReply('No linked account found for your Discord user.');
  }
};
