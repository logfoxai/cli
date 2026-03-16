import {getConfig} from '../config';

export function showStatus(): void {

    const config = getConfig();

    if (!config.authToken) {

        console.log('Not logged in.');
        console.log('Run "logfox login" to authenticate.');
        return;

    }

    console.log(`User:  ${config.userEmail || config.userId || 'unknown'}`);
    console.log(`Team:  ${config.teamName || config.teamId || 'none selected'}`);

}
