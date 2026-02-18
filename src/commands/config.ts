import {getConfig, saveConfig, clearConfig} from '../config';
import * as api from '../api';

export function showConfig(): void {

    const config = getConfig();
    console.log('Current configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log();
    console.log('Commands:');
    console.log('  logspace config:get <key>          Get a config value');
    console.log('  logspace config:set <key> <value>  Set a config value');
    console.log('  logspace config:reset              Reset to defaults');
    console.log();
    console.log('Valid keys: apiUrl, appUrl, teamId');

}

export function getConfigValue(key: string): void {

    const config = getConfig();
    const value = config[key as keyof typeof config];

    if (value === undefined) {

        console.error(`Unknown config key: ${key}`);
        process.exit(1);

    }

    console.log(value);

}

export async function setConfig(key: string, value: string): Promise<void> {

    if (key !== 'apiUrl' && key !== 'appUrl' && key !== 'teamId') {

        console.error(`Invalid config key: ${key}`);
        console.log('Valid keys: apiUrl, appUrl, teamId');
        process.exit(1);

    }

    // If setting teamId, also fetch and save the team name
    if (key === 'teamId') {

        const teamsResult = await api.getMyTeams();

        if (teamsResult.ok) {

            const team = teamsResult.data.find(t => t.id === value);

            if (team) {

                saveConfig({teamId: value, teamName: team.name});
                console.log(`Switched to team: ${team.name}`);
                return;

            }

        }

        // Fallback if we can't find the team name
        saveConfig({teamId: value, teamName: undefined});
        console.log(`Set teamId = ${value}`);
        return;

    }

    saveConfig({[key]: value});
    console.log(`Set ${key} = ${value}`);

}

export function resetConfig(): void {

    clearConfig();
    console.log('Configuration reset to defaults.');

}
