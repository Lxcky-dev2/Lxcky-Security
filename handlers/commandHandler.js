"use strict";

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = {
    async load(client) {
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFolders = getFolders(commandsPath);

        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);

                if (command.data && command.execute) {
                    client.commands.set(command.data.name, command);
                    console.log(`[LOADED] Command: ${command.data.name} (${folder})`);
                } else {
                    console.warn(`[SKIP] ${file}: missing "data" or "execute"`);
                }
            }
        }

        console.log(`[LOADED] ${client.commands.size} commands total.`);
    },

    async registerCommands(client) {
        const commands = [];
        for (const cmd of client.commands.values()) {
            commands.push(cmd.data.toJSON ? cmd.data.toJSON() : cmd.data);
        }

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

        try {
            console.log(`[REGISTER] Registering ${commands.length} slash commands...`);
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('[REGISTER] Slash commands registered successfully!');
        } catch (error) {
            console.error('[REGISTER] Failed to register commands:', error);
        }
    }
};

// Helper: Get all subfolders in a directory
function getFolders(dir) {
    try {
        return fs.readdirSync(dir).filter(file => fs.statSync(path.join(dir, file)).isDirectory());
    } catch {
        return [];
    }
}