"use strict";

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createMessage, createActionRow, createButton, COLORS } = require('../../utils/componentBuilder.js');
const Account = require('../../db/models/Account.js');
const GuildSettings = require('../../db/models/GuildSettings.js');
const { createSecurityReport } = require('../../utils/centralReporting.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report a suspicious user to moderators')
        .addStringOption(option => option
            .setName('userid')
            .setDescription('Discord User ID of the person to report')
            .setRequired(true))
        .addStringOption(option => option
            .setName('reason')
            .setDescription('Why are you reporting this user?')
            .setRequired(true)
            .setMaxLength(500)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userId = interaction.options.getString('userid', true).trim();
        const reason = interaction.options.getString('reason', true).trim();

        if (!/^\d{17,20}$/.test(userId)) {
            return interaction.editReply(createMessage({
                title: 'Invalid User ID',
                data: { Message: 'The provided ID is not a valid Discord User ID.' },
                color: COLORS.danger
            }));
        }

        let account = await Account.findOne({ dcId: interaction.user.id, guildId: interaction.guildId });

        if (account?.lastReportAt) {
            const cooldown = 5 * 60 * 1000;
            const timeSince = Date.now() - account.lastReportAt.getTime();
            if (timeSince < cooldown) {
                const remaining = Math.ceil((cooldown - timeSince) / 1000);
                return interaction.editReply(createMessage({
                    title: 'Report Cooldown',
                    data: { Message: `Please wait ${remaining} seconds before reporting again.` },
                    color: COLORS.warning
                }));
            }
        }

        if (!account) {
            account = new Account({
                dcId: interaction.user.id,
                guildId: interaction.guildId
            });
        }

        account.lastReportAt = new Date();
        await account.save();

        const settings = await GuildSettings.findOne({ guildId: interaction.guildId });
        const modChannel = settings?.logChannelId
            ? interaction.guild.channels.cache.get(settings.logChannelId)
            : null;

        if (modChannel?.isTextBased()) {
            await modChannel.send({
                ...createMessage({
                    title: ' User Report',
                    data: {
                        'Reported User': `<@${userId}> (${userId})`,
                        'Reported By': `${interaction.user.tag} (${interaction.user.id})`,
                        Reason: reason,
                        Status: 'Pending Review'
                    },
                    color: COLORS.warning,
                    components: [createActionRow(
                        createButton({ label: 'Investigate', customId: `localreport_investigate_${userId}`, style: 'primary' }),
                        createButton({ label: 'Dismiss', customId: `localreport_dismiss_${userId}`, style: 'secondary' })
                    )]
                })
            }).catch(error => console.error('[REPORT] Failed to send local moderator report:', error));
        }

        await createSecurityReport({
            kind: 'user_report',
            guildId: interaction.guildId,
            guildName: interaction.guild.name,
            targetId: userId,
            targetTag: `<@${userId}>`,
            actorId: interaction.user.id,
            actorTag: interaction.user.tag,
            action: 'USER REPORT SUBMITTED',
            reason
        }).catch(error => console.error('[REPORT] Failed to create central report:', error));

        return interaction.editReply(createMessage({
            title: ' Report Submitted',
            data: {
                Status: 'Your report has been sent to the moderators.',
                'Reported User': `<@${userId}>`,
                Reason: reason
            },
            color: COLORS.success
        }));
    }
};
