"use strict";

const GlobalEntry = require('../db/models/GlobalEntry.js');
const { sendDatabaseAudit } = require('./centralReporting.js');

function validDiscordId(id) {
  return /^\d{17,20}$/.test(id);
}

async function addEntry(client, { discordId, type, status = 'blacklisted', reason, evidence, actorId, metadata = {} }) {
  if (!validDiscordId(discordId)) throw new Error('Invalid Discord ID.');
  if (!['user', 'bot'].includes(type)) throw new Error('Type must be user or bot.');

  const entry = await GlobalEntry.findOneAndUpdate(
    { discordId },
    {
      $set: { type, status, reason: reason || 'No reason provided', evidence: evidence || null, updatedBy: actorId, metadata },
      $setOnInsert: { addedBy: actorId, addedAt: new Date() }
    },
    { new: true, upsert: true }
  );

  await sendDatabaseAudit(client, {
    action: 'ADD_OR_UPDATE',
    targetId: discordId,
    targetType: type,
    actorId,
    reason: entry.reason,
    metadata: { status: entry.status, evidence: entry.evidence || 'None' }
  }).catch(() => {});

  return entry;
}

async function removeEntry(client, { discordId, actorId }) {
  const existing = await GlobalEntry.findOne({ discordId });
  if (!existing) return null;
  await GlobalEntry.deleteOne({ discordId });

  await sendDatabaseAudit(client, {
    action: 'REMOVE',
    targetId: discordId,
    targetType: existing.type,
    actorId,
    reason: existing.reason,
    metadata: { previousStatus: existing.status }
  }).catch(() => {});

  return existing;
}

async function searchEntry(discordId) {
  if (!validDiscordId(discordId)) return null;
  return GlobalEntry.findOne({ discordId });
}

module.exports = { validDiscordId, addEntry, removeEntry, searchEntry };
