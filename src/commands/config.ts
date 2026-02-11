import {getConfig, saveConfig} from '../config';

export function showConfig(): void {

    const config = getConfig();
    console.log('Current configuration:');
    console.log(JSON.stringify(config, null, 2));

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
