import {getConfig} from '../config';
import * as api from '../api';

export async function listSessions(): Promise<void> {

    const config = getConfig();

    if (!config.teamId) {

        console.error('No team configured. Run "logspace login" first.');
        process.exit(1);

    }

    const result = await api.getLocalDevSessions(config.teamId);

    if (!result.ok) {

        console.error('Failed to get sessions:', result.error);
        process.exit(1);

    }

    if (result.data.length === 0) {

        console.log('No local dev sessions found.');
        console.log('Create one with: logspace run --name <app-name> -- <command>');
        return;

    }

    console.log('Your local dev sessions:');
    console.log();

    for (const session of result.data) {

        const created = new Date(session.createdAt).toLocaleString();
        console.log(`  ${session.appName}`);
        console.log(`    Label: ${session.label}`);
        console.log(`    ID: ${session.id}`);
        console.log(`    Created: ${created}`);
        console.log();

    }

}

export async function deleteSession(sessionId: string): Promise<void> {

    const result = await api.deleteLocalDevSession(sessionId);

    if (!result.ok) {

        console.error('Failed to delete session:', result.error);
        process.exit(1);

    }

    console.log('Session deleted successfully.');

}
