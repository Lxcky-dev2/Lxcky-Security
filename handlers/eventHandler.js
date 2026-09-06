"use strict";

const { Collection, Events, MessageFlags } = require('discord.js');
const { handleComponentInteraction, registerComponentHandler } = require('./componentHandler.js');
const { commandHasPermission, hasDiscordPermission } = require('../utils/permissions.js');

// Import component handlers
const { handleSecurityPanelButton } = require('../utils/securityPanels.js');
const { handleSettingsPanel } = require('../utils/settingsPanel.js');
const { handleUserDashboard } = require('../utils/userDashboard.js');
const { handleApprovalFlow } = require('../utils/approvalFlow.js');
const { handleOwnerPanel, handleOwnerSelect, handleOwnerModal } = require('../utils/ownerPanel.js');
const { handleStaffPanel, handleStaffSelect, handleStaffModal } = require('../utils/staffPanel.js');
const { handleReportComponent } = require('../utils/centralReporting.js');
const { handleLocalReportComponent } = require('../utils/localReport.js');
const { ensureGuildConfig, ensureFeatureConfigs } = require('../utils/configPersistence.js');
const { handleTicketComponent } = require('../utils/ticketSystem.js');
const verification = require('../utils/verification.js');
const autoMod = require('../utils/autoMod.js');
const logsPanel = require('../utils/logsPanel.js');
const antiNuke = require('../utils/antiNuke.js');
const externalAppProtection = require('../utils/externalAppProtection.js');
const antiRaid = require('../utils/antiRaid.js');
const whitelist = require('../utils/whitelist.js');

module.exports = {
    async load(client) {
        global.client = client;

        client.once(Events.ClientReady, async (c) => {
            console.log(`[BOT] Online as ${c.user.tag}`);
            const commandHandler = require('./commandHandler.js');
            await commandHandler.registerCommands(client);
            const giveaway = require('../commands/security/giveaway.js');
            await giveaway.processDueGiveaways(client).catch(() => {});
            setInterval(() => giveaway.processDueGiveaways(client).catch(() => {}), 5000);
        });

        const fullLogger = require('../utils/fullLogger.js');
        const linkFilter = require('../utils/linkFilter.js');
        const welcomer = require('../utils/welcomer.js');
        const giveaway = require('../commands/security/giveaway.js');

        client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    if (command.requiredPermission && interaction.inGuild()) {
                        if (!commandHasPermission(interaction.member, command.requiredPermission)) {
                            await interaction.reply({
                                content: 'You do not have the required Discord permission to use this command.',
                                flags: 64
                            }).catch(() => {});
                            return;
                        }
                    }
                    await command.execute(interaction);
                    if (interaction.inGuild()) await fullLogger.command(client, interaction);
                } catch (error) {
                    console.error(`[ERROR] Executing ${interaction.commandName}:`, error);
                    const errorReply = {
                        content: 'An error occurred while executing this command.',
                        flags: MessageFlags.Ephemeral,
                    };
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply(errorReply).catch(() => {});
                    } else {
                        await interaction.reply(errorReply).catch(() => {});
                    }
                }
                return;
            }

            if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isModalSubmit()) {
                await handleComponentInteraction(interaction);
            }
        });

        // ---- GUILD CONFIG PERSISTENCE ----
        client.on(Events.GuildCreate, async (guild) => {
            await ensureGuildConfig(guild).catch((error) => console.error('[CONFIG] Failed to persist guild settings:', error));
            await ensureFeatureConfigs(guild).catch((error) => console.error('[CONFIG] Failed to persist feature configs:', error));
        });

        // ---- GUILD MEMBER ADD (Suspicious join detection + Global blacklist) ----
        client.on(Events.GuildMemberAdd, async (member) => {
            const { checkSuspiciousJoin } = require('../utils/securityChecks.js');
            await checkSuspiciousJoin(member);
            await antiRaid.checkRaid(member).catch(error => console.error('[ANTIRAID]', error));
            await verification.ensureUnverified(member, await verification.getConfig(member.guild.id));
            const fullLogger = require('../utils/fullLogger.js');
            await fullLogger.memberJoin(client, member);
        });

        // ---- MESSAGE CREATE (Spam + links + AFK) ----
        client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot) return;
            const { checkSpam } = require('../utils/spamFilter.js');
            const { handleAFKOnMessage } = require('../utils/afkManager.js');
            await Promise.allSettled([
                checkSpam(message),
                linkFilter.checkMessage(message),
                autoMod.checkMessage(message),
                handleAFKOnMessage(message, client)
            ]);
        });

        // ---- WELCOMER ----
        client.on(Events.GuildMemberAdd, async (member) => {
            await welcomer.handleMemberJoin(member).catch(() => {});
        });
        client.on(Events.GuildMemberRemove, async (member) => {
            await welcomer.handleMemberLeave(member).catch(() => {});
            await fullLogger.memberLeave(client, member).catch(() => {});
        });

        // ---- FULL SERVER LOGGING ----
        client.on(Events.MessageDelete, (message) => fullLogger.messageDelete(client, message));
        client.on(Events.MessageBulkDelete, (messages) => fullLogger.messageBulkDelete(client, messages));
        client.on(Events.MessageUpdate, (oldMessage, newMessage) => fullLogger.messageUpdate(client, oldMessage, newMessage));
        client.on(Events.RoleCreate, (role) => fullLogger.roleCreate(client, role));
        client.on(Events.RoleDelete, (role) => fullLogger.roleDelete(client, role));
        client.on(Events.RoleUpdate, (oldRole, newRole) => fullLogger.roleUpdate(client, oldRole, newRole));
        client.on(Events.GuildMemberUpdate, (oldMember, newMember) => fullLogger.memberUpdate(client, oldMember, newMember));
        client.on(Events.GuildBanAdd, (ban) => fullLogger.banAdd(client, ban));
        client.on(Events.GuildBanRemove, (ban) => fullLogger.banRemove(client, ban));
        client.on(Events.ChannelCreate, (channel) => { fullLogger.channelCreate(client, channel); externalAppProtection.applyToNewChannel(channel).catch(()=>{}); });
        client.on(Events.ChannelDelete, (channel) => fullLogger.channelDelete(client, channel));
        client.on(Events.ChannelUpdate, (oldChannel, newChannel) => fullLogger.channelUpdate(client, oldChannel, newChannel));
        client.on(Events.VoiceStateUpdate, (oldState, newState) => fullLogger.voice(client, oldState, newState));
        client.on(Events.WebhooksUpdate, (channel) => fullLogger.webhook(client, channel.guild));
        client.on(Events.GuildUpdate, (oldGuild, newGuild) => fullLogger.guildUpdate(client, oldGuild, newGuild));
        client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => antiNuke.process(entry, guild).catch(error => console.error('[ANTINUKE]', error)));

        // ---- GIVEAWAY BUTTONS ----
        registerComponentHandler('giveaway_', giveaway.handleComponent);
        registerComponentHandler('welcomer_', async (interaction) => {
            if (interaction.isModalSubmit()) return welcomer.modal(interaction);
            if (interaction.isChannelSelectMenu() || interaction.isButton()) return welcomer.component(interaction);
        });
        registerComponentHandler('links_', async (interaction) => {
            if (interaction.isModalSubmit()) return linkFilter.modal(interaction);
            if (interaction.isRoleSelectMenu()) return linkFilter.roles(interaction);
            if (interaction.isStringSelectMenu()) return linkFilter.select(interaction);
            if (interaction.isButton()) {
                if (interaction.customId.startsWith('links_toggle_') || interaction.customId.startsWith('links_bypass_')) {
                    return linkFilter.specificButton(interaction);
                }
                return linkFilter.component(interaction);
            }
        });

        // ---- REGISTER ALL COMPONENT HANDLERS ----
        registerComponentHandler('panel_', handleSecurityPanelButton);
        registerComponentHandler('toggle_', handleSecurityPanelButton);
        registerComponentHandler('settings_', handleSettingsPanel);
        registerComponentHandler('assign_', handleSettingsPanel);
        registerComponentHandler('dashboard_', handleUserDashboard);
        registerComponentHandler('approve_', handleApprovalFlow);
        registerComponentHandler('banuser_', handleApprovalFlow);
        registerComponentHandler('investigate_', handleApprovalFlow);
        registerComponentHandler('back_', handleApprovalFlow);
        registerComponentHandler('owner_', async (interaction) => {
            if (interaction.isModalSubmit()) return handleOwnerModal(interaction);
            if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) return handleOwnerSelect(interaction);
            return handleOwnerPanel(interaction);
        });
        registerComponentHandler('staff_', async (interaction) => {
            if (interaction.isModalSubmit()) return handleStaffModal(interaction);
            if (interaction.isStringSelectMenu()) return handleStaffSelect(interaction);
            return handleStaffPanel(interaction);
        });
        registerComponentHandler('report_', handleReportComponent);
        registerComponentHandler('localreport_', handleLocalReportComponent);
        registerComponentHandler('ticket_', handleTicketComponent);
        registerComponentHandler('verify_', async (interaction) => verification.component(interaction));
        registerComponentHandler('automod_', async (interaction) => { if (interaction.isModalSubmit()) return autoMod.modal(interaction); if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) return autoMod.select(interaction); return autoMod.component(interaction); });
        registerComponentHandler('logs_', async (interaction) => logsPanel.component(interaction));
        registerComponentHandler('whitelist_', async (interaction) => {
            if (interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) return whitelist.select(interaction);
            return whitelist.component(interaction);
        });
        registerComponentHandler('antinuke_', async (interaction) => {
            if (!interaction.guild) return;
            const { hasPermission } = require('../utils/permissionChecker.js');
            if (!(await hasPermission(interaction.member, 'manageGuild'))) return interaction.reply({content:'Manage Server permission is required.',flags:64});
            const GuildSettings = require('../db/models/GuildSettings.js');
            const s = await GuildSettings.findOne({guildId:interaction.guildId});
            if (interaction.customId==='antinuke_toggle'){s.antiNuke=!s.antiNuke;await s.save();return interaction.update({embeds:[{title:'Anti-Nuke Settings',fields:[{name:'Enabled',value:s.antiNuke?'Yes':'No'}]}],components:[],flags:64});}
        });

        console.log('[EVENTS] All event handlers and component handlers loaded.');
    }
};