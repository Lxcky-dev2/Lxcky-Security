const { SlashCommandBuilder } = require('discord.js')
const { isAdmin } = require('../utils/permissions')
const { build } = require('../utils/embed')
const Whitelist = require('../db/Whitelist')

module.exports = {
  data: new SlashCommandBuilder().setName('whitelist_list').setDescription('List whitelisted realm ids (admins only)'),
  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) return interaction.reply({ embeds: [build({ title: 'Error', description: 'You are not authorized to use this command.', color: 0xF43F5E })], ephemeral: true })
    try {
      const docs = await Whitelist.find({}).lean()
      if (!docs || docs.length === 0) return interaction.reply({ embeds: [build({ title: 'Whitelist', description: 'No whitelisted realms.', color: 0x6C8CFF })], ephemeral: true })
      const lines = docs.map(d => `• ${d.realmId} (added by ${d.addedBy || 'unknown'})`).join('\n')
      return interaction.reply({ embeds: [build({ title: 'Whitelisted Realms', description: lines, color: 0x6C8CFF })], ephemeral: true })
    } catch (e) {
      console.error('whitelist_list failed', e)
      return interaction.reply({ embeds: [build({ title: 'Error', description: 'Failed to list whitelist entries.', color: 0xF43F5E })], ephemeral: true })
    }
  }
}
