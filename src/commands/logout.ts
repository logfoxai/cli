import {clearConfig} from '../config';

export function logout(): void {

    clearConfig();
    console.log('Logged out successfully.');

}
