const { SlashCommandBuilder } = require('discord.js')
const { isAdmin } = require('../utils/permissions')
const { build } = require('../utils/embed')
const { addProtected } = require('../functions/whitelist')

module.exports = {
  data: new SlashCommandBuilder().setName('whitelist_add').setDescription('Add a realm id to the whitelist (admins only)').addStringOption(opt => opt.setName('realm').setDescription('Realm id').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) return interaction.reply({ embeds: [build({ title: 'Error', description: 'You are not authorized to use this command.', color: 0xF43F5E })], ephemeral: true })
    const realm = interaction.options.getString('realm')
    try {
      await addProtected(realm, interaction.user.id)
      return interaction.reply({ embeds: [build({ title: 'Whitelist', description: `Added realm \`${realm}\` to whitelist.`, color: 0x4ADE80 })], ephemeral: true })
    } catch (e) {
      console.error('whitelist_add failed', e)
      return interaction.reply({ embeds: [build({ title: 'Error', description: 'Failed to add whitelist entry.', color: 0xF43F5E })], ephemeral: true })
    }
  }
}
