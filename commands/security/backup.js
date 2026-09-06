"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMessage, COLORS } = require('../../utils/componentBuilder.js');
const { createBackup, restoreBackup, getLatestBackup } = require('../../utils/backupManager.js');
const ServerBackup = require('../../db/models/ServerBackups.js');
const { hasPermission } = require('../../utils/permissionChecker.js');

module.exports = {
    requiredPermission: 'manageGuild',
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Create, load, or delete server backups')
        .addSubcommand(sub => 
            sub.setName('create')
                .setDescription('Create a full backup of the server')
        )
        .addSubcommand(sub => 
            sub.setName('load')
                .setDescription('Restore a backup by ID')
                .addStringOption(opt => 
                    opt.setName('id')
                        .setDescription('Backup ID to restore')
                        .setRequired(true)
                )
                .addBooleanOption(opt => opt
                    .setName('replace')
                    .setDescription('Delete channels/roles not present in the backup')
                    .setRequired(false)
                )
        )
        .addSubcommand(sub => 
            sub.setName('delete')
                .setDescription('Delete a backup by ID')
                .addStringOption(opt => 
                    opt.setName('id')
                        .setDescription('Backup ID to delete')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub => 
            sub.setName('list')
                .setDescription('List all backups for this server')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: 64 });
        } catch (error) {
            await interaction.reply({
                content: 'Command timed out. Please try again.',
                flags: 64
            }).catch(() => {});
            return;
        }

        const hasAccess = await hasPermission(interaction.member, 'manageGuild');
        if (!hasAccess) {
            await interaction.editReply({
                content: 'You do not have permission to use this command.'
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'create') {
            const backup = await createBackup(interaction.guild, interaction.user.id, { automatic: false });

            await interaction.editReply({
                ...createMessage({
                    title: 'Backup Created',
                    data: {
                        'Backup ID': `\`${backup.backupId}\``,
                        'Channels': backup.snapshot.channels.length,
                        'Roles': backup.snapshot.roles.length,
                        'Created At': backup.timestamp.toUTCString()
                    },
                    color: COLORS.success
                })
            });
            return;
        }

        if (subcommand === 'load') {
            let backupId = interaction.options.getString('id');

            try {
                if (backupId.toLowerCase() === 'latest') {
                    const latest = await getLatestBackup(interaction.guildId);
                    if (!latest) throw new Error('No backups exist for this server.');
                    backupId = latest.backupId;
                }
                const replace = interaction.options.getBoolean('replace') ?? true;
                await restoreBackup(interaction.guild, backupId, { replace });
                await interaction.editReply({
                    ...createMessage({
                        title: 'Backup Restored',
                        data: {
                            'Backup ID': `\`${backupId}\``,
                            'Status': 'Server restored successfully'
                        },
                        color: COLORS.success
                    })
                });
            } catch (error) {
                await interaction.editReply({
                    ...createMessage({
                        title: 'Restore Failed',
                        data: {
                            'Backup ID': `\`${backupId}\``,
                            'Error': error.message || 'Backup not found or invalid'
                        },
                        color: COLORS.danger
                    })
                });
            }
            return;
        }

        if (subcommand === 'delete') {
            const backupId = interaction.options.getString('id');

            const backup = await ServerBackup.findOne({ guildId: interaction.guildId, backupId });
            if (!backup) {
                await interaction.editReply({
                    ...createMessage({
                        title: 'Backup Not Found',
                        data: { 'Backup ID': `\`${backupId}\`` },
                        color: COLORS.warning
                    })
                });
                return;
            }

            await backup.deleteOne();

            await interaction.editReply({
                ...createMessage({
                    title: 'Backup Deleted',
                    data: {
                        'Backup ID': `\`${backupId}\``,
                        'Status': 'Backup removed from database'
                    },
                    color: COLORS.success
                })
            });
            return;
        }

        if (subcommand === 'list') {
            const backups = await ServerBackup.find({ guildId: interaction.guildId }).sort({ timestamp: -1 });

            if (backups.length === 0) {
                await interaction.editReply({
                    ...createMessage({
                        title: 'No Backups Found',
                        data: { 'Status': 'No backups exist for this server.' },
                        color: COLORS.warning
                    })
                });
                return;
            }

            const backupList = backups.map((b, i) => {
                return `${i + 1}. \`${b.backupId}\` - ${b.timestamp.toUTCString()} - By <@${b.createdBy}>`;
            }).join('\n');

            await interaction.editReply({
                ...createMessage({
                    title: 'Backup List',
                    data: {
                        'Total Backups': backups.length,
                        'Backups': backupList
                    },
                    color: COLORS.default
                })
            });
            return;
        }
    }
};