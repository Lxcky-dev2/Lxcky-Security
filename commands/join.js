"use strict";
const { SlashCommandBuilder } = require("discord.js");
const { build } = require("../utils/embed")
const Realm = require("../classes/Realm.js");
const createInstance = require("../functions/client.js");
const { getErrorMessage, errorEmbed } = require("../functions/errors.js");

const JOIN_DURATION_MS = 20000;
const currentlyJoining = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Test-join one of your linked Realms for 20 seconds, then leave')
        .addStringOption(opt => opt.setName('realmcode').setDescription('Realm invite code or Realm ID').setRequired(true)),

    async execute(interaction) {
        const dbUser = interaction.user.id;
        const input = interaction.options.getString('realmcode');

        if (currentlyJoining.has(dbUser)) {
            return interaction.reply({ embeds: [build({ title: 'Join', description: 'You already have a test-join running.', color: 0xFACC15 })], ephemeral: true });
        }

        await interaction.deferReply();
        await interaction.editReply({ embeds: [build({ title: 'Join', description: `Resolving realm...\n-# Input: \`${input}\``, color: 0x6C8CFF })] });

        let client = null;
        currentlyJoining.add(dbUser);

        try {
            const RealmAPI = new Realm(dbUser);
            await RealmAPI.init();

            const realmResult = /^\d+$/.test(input)
                ? await RealmAPI.getRealmInfoByID(input)
                : await RealmAPI.getRealmInfoByCode(input);

            if (realmResult.status !== 200) {
                currentlyJoining.delete(dbUser);
                return interaction.editReply({ embeds: [errorEmbed('Join', null, getErrorMessage(realmResult.body))] });
            }

            const realm = realmResult.body;

            let check = await RealmAPI.doRealmChecks(realm, null);
            if (check?.errorMsg) {
                currentlyJoining.delete(dbUser);
                return interaction.editReply({ embeds: [errorEmbed('Join', realm, getErrorMessage(check))] });
            }

            const joinResult = await RealmAPI.getRealmIP(realm.id);
            if (joinResult.status !== 200) {
                currentlyJoining.delete(dbUser);
                return interaction.editReply({ embeds: [errorEmbed('Join', realm, getErrorMessage(joinResult.body))] });
            }

            check = await RealmAPI.doRealmChecks(null, joinResult.body);
            if (check?.errorMsg) {
                currentlyJoining.delete(dbUser);
                return interaction.editReply({ embeds: [errorEmbed('Join', realm, getErrorMessage(check))] });
            }

            await interaction.editReply({ embeds: [build({ title: 'Join', description: `**${realm.name}** · \`${realm.id}\`\n-# Connecting...`, color: 0x6C8CFF })] });

            client = await createInstance(realm, dbUser, joinResult.body);

            let settled = false;
            let leaveTimer = null;

            const finish = async (embed) => {
                if (settled) return;
                settled = true;
                if (leaveTimer) clearTimeout(leaveTimer);
                currentlyJoining.delete(dbUser);
                await interaction.editReply({ embeds: [embed] }).catch(() => {});
            };

            const onFail = (label, detail) => {
                try { client.disconnect?.('Join test failed'); } catch (_) {}
                finish(errorEmbed('Join', realm, `${label}${detail ? `: ${detail}` : ''}`));
            };

            client.on('error', (err) => onFail('Connection error', err?.message || String(err)));
            client.on('kick', (params) => onFail('Kicked by realm', params?.message || JSON.stringify(params)));
            client.on('close', (reason) => onFail('Connection closed unexpectedly', reason));

            leaveTimer = setTimeout(() => {
                if (settled) return;
                try { client.disconnect('Leaving after test join'); } catch (e) { console.error('Disconnect failed', e); }
                finish(build({ title: 'Join', description: `**${realm.name}** · \`${realm.id}\`\n-# Connected successfully and left after 20s ✅`, color: 0x4ADE80 }));
            }, JOIN_DURATION_MS);

            await interaction.editReply({ embeds: [build({ title: 'Join', description: `**${realm.name}** · \`${realm.id}\`\n-# Connected. Leaving in 20 seconds...`, color: 0x4ADE80 })] });

        } catch (error) {
            console.error(error);
            currentlyJoining.delete(dbUser);
            try { client?.disconnect?.('Error during join'); } catch (_) {}
            await interaction.editReply({ embeds: [errorEmbed('Join', null, getErrorMessage(error))] }).catch(() => {});
        }
    }
};
