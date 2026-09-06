const { EmbedBuilder } = require('discord.js')

function build({ title = '', description = '', color = 0x6C8CFF, fields = [], thumbnail = null, footer = null } = {}) {
  const e = new EmbedBuilder()
  if (title) e.setTitle(title)
  if (description) e.setDescription(description)
  if (color) e.setColor(color)
  if (thumbnail) e.setThumbnail(thumbnail)
  if (footer) e.setFooter({ text: String(footer) })
  if (fields && Array.isArray(fields)) {
    for (const f of fields) {
      if (f.name && f.value) e.addFields({ name: f.name, value: f.value, inline: !!f.inline })
    }
  }
  e.setTimestamp()
  return e
}

module.exports = { build }
