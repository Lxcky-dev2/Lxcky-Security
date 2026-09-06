"use strict";
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
const { ensureAllGuildConfigs, ensureOwnerConfig } = require('./utils/configPersistence.js');
const TOKEN=process.env.TOKEN;
const MONGO_URI=process.env.MONGO_URI||process.env.MONGODB_URI;
const CLIENT_ID=process.env.CLIENT_ID;
const OWNER_ID=process.env.OWNER_ID;
const missing=[]; if(!TOKEN)missing.push('TOKEN'); if(!MONGO_URI)missing.push('MONGO_URI'); if(!CLIENT_ID)missing.push('CLIENT_ID'); if(!OWNER_ID)missing.push('OWNER_ID');
if(missing.length){console.error(`[CONFIG] Missing environment variable(s): ${missing.join(', ')}`);process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMessageReactions,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildPresences,GatewayIntentBits.DirectMessages,GatewayIntentBits.GuildModeration],partials:[Partials.Channel,Partials.Message,Partials.User,Partials.GuildMember,Partials.Reaction]});
client.commands=new Map();client.cooldowns=new Map();client.config={token:TOKEN,mongoUri:MONGO_URI,clientId:CLIENT_ID,ownerId:OWNER_ID};
client.once('ready',()=>{client.user.setPresence({status:'dnd',activities:[{name:'https://discord.gg/xr5F3VcxVq',type:ActivityType.Watching}]});console.log(`[BOT] Presence set: Do Not Disturb | Watching https://discord.gg/xr5F3VcxVq`);});
async function start(){try{await mongoose.connect(MONGO_URI);console.log('[DATABASE] MongoDB connected');const commandHandler=require('./handlers/commandHandler.js');const eventHandler=require('./handlers/eventHandler.js');await commandHandler.load(client);await eventHandler.load(client);await client.login(TOKEN);
        // The guild cache is populated after login, so persistent guild config initialization belongs here.
        await ensureAllGuildConfigs(client);
        await ensureOwnerConfig();
        // Automatic structure backups make recovery available even when admins forget to run /backup create.
        const { startAutomaticBackups } = require('./utils/backupManager.js');
        startAutomaticBackups(client).catch(error => console.error('[BACKUP] Auto-backup start failed:', error));}catch(e){console.error('[STARTUP] Fatal error:',e);process.exit(1);}}
process.on('unhandledRejection',e=>console.error('[ERROR] Unhandled rejection:',e));process.on('uncaughtException',e=>console.error('[ERROR] Uncaught exception:',e));start();
