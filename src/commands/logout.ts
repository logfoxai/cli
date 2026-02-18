import {saveConfig} from '../config';

export function logout(): void {

    // Only clear auth-related fields, keep apiUrl/appUrl settings
    saveConfig({authToken: undefined, userId: undefined, teamId: undefined});
    console.log('Logged out successfully.');

}
