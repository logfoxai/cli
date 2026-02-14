import {getConfig} from '../config';
import * as api from '../api';

export async function listTeams(): Promise<void> {

    const config = getConfig();

    if (!config.authToken) {

        console.error('Not logged in. Run "logspace login" first.');
        process.exit(1);

    }

    const result = await api.getMyTeams();

    if (!result.ok) {

        console.error('Failed to get teams:', result.error);
        process.exit(1);

    }

    if (result.data.length === 0) {

        console.log('No teams found.');
        return;

    }

    console.log('Your teams:');
    console.log();

    for (const team of result.data) {

        const isDefault = team.id === config.teamId ? ' (active)' : '';
        console.log(`  ${team.name}${isDefault}`);
        console.log(`    ID: ${team.id}`);
        console.log();

    }

    console.log('To switch teams: logspace config:set teamId <id>');

}
