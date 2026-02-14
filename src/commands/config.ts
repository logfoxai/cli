import {getConfig, saveConfig, clearConfig} from '../config';

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
    console.log('Valid keys: apiUrl, appUrl');

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

export function setConfig(key: string, value: string): void {

    if (key !== 'apiUrl' && key !== 'appUrl') {

        console.error(`Invalid config key: ${key}`);
        console.log('Valid keys: apiUrl, appUrl');
        process.exit(1);

    }

    saveConfig({[key]: value});
    console.log(`Set ${key} = ${value}`);

}

export function resetConfig(): void {

    clearConfig();
    console.log('Configuration reset to defaults.');

}
