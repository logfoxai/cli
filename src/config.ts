import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.logspace');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export type Config = {
    authToken?: string
    apiUrl: string
    appUrl: string
    teamId?: string
    userId?: string
};

const DEFAULT_CONFIG: Config = {
    apiUrl: 'https://api.logspace.sh',
    appUrl: 'https://app.logspace.sh',
};

export function getConfig(): Config {

    try {

        if (fs.existsSync(CONFIG_FILE)) {

            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return {...DEFAULT_CONFIG, ...JSON.parse(data)};

        }

    } catch {
        // Ignore errors, return default
    }

    return DEFAULT_CONFIG;

}

export function saveConfig(config: Partial<Config>): void {

    const current = getConfig();
    const merged = {...current, ...config};

    if (!fs.existsSync(CONFIG_DIR)) {

        fs.mkdirSync(CONFIG_DIR, {recursive: true});

    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));

}

export function clearConfig(): void {

    if (fs.existsSync(CONFIG_FILE)) {

        fs.unlinkSync(CONFIG_FILE);

    }

}
