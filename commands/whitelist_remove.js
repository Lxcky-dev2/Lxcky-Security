const { SlashCommandBuilder } = require('discord.js')
const { isAdmin } = require('../utils/permissions')
const { build } = require('../utils/embed')
const { removeProtected } = require('../functions/whitelist')

module.exports = {
  data: new SlashCommandBuilder().setName('whitelist_remove').setDescription('Remove a realm id from the whitelist (admins only)').addStringOption(opt => opt.setName('realm').setDescription('Realm id').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) return interaction.reply({ embeds: [build({ title: 'Error', description: 'You are not authorized to use this command.', color: 0xF43F5E })], ephemeral: true })
    const realm = interaction.options.getString('realm')
    try {
      await removeProtected(realm)
      return interaction.reply({ embeds: [build({ title: 'Whitelist', description: `Removed realm \`${realm}\` from whitelist.`, color: 0x4ADE80 })], ephemeral: true })
    } catch (e) {
      console.error('whitelist_remove failed', e)
      return interaction.reply({ embeds: [build({ title: 'Error', description: 'Failed to remove whitelist entry.', color: 0xF43F5E })], ephemeral: true })
    }
  }
}
