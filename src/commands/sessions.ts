import {getConfig} from '../config';
import * as api from '../api';

export async function listSessions(): Promise<void> {

    const config = getConfig();

    if (!config.teamId) {

        console.error('No team configured. Run "logspace login" first.');
        process.exit(1);

    }

    if (!config.userId) {

        console.error('User ID not found. Run "logspace logout" then "logspace login" again.');
        process.exit(1);

    }

    // Get apps created by this user
    const result = await api.searchApps({teamId: config.teamId, createdByUserId: config.userId});

    if (!result.ok) {

        console.error('Failed to get apps:', result.error);
        process.exit(1);

    }

    // Filter to only local apps
    const localApps = result.data.filter((app) => app.name.startsWith('local-'));

    if (localApps.length === 0) {

        console.log('No local dev apps found.');
        console.log('Create one with: logspace run --name <app-name> -- <command>');
        return;

    }

    console.log('Your local dev apps:');
    console.log();

    for (const app of localApps) {

        const created = new Date(app.createdAt).toLocaleString();
        console.log(`  ${app.name}`);
        console.log(`    ID: ${app.id}`);
        console.log(`    Created: ${created}`);
        console.log();

    }

}

export async function deleteSession(appId: string): Promise<void> {

    const config = getConfig();

    if (!config.teamId) {

        console.error('No team configured. Run "logspace login" first.');
        process.exit(1);

    }

    const result = await api.deleteApp(appId, config.teamId);

    if (!result.ok) {

        console.error('Failed to delete app:', result.error);
        process.exit(1);

    }

    console.log('Local app deleted successfully.');

}
