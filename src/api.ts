import {getConfig} from './config';

type ApiResponse<T> = {
    ok: true
    data: T
} | {
    ok: false
    error: string
};

async function apiCall<T>(method: string, body?: unknown): Promise<ApiResponse<T>> {

    const config = getConfig();

    if (!config.authToken) {

        return {ok: false, error: 'Not logged in. Run: logspace login'};

    }

    try {

        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.authToken}`,
            },
            body: JSON.stringify({
                method,
                args: body ? [body] : [],
            }),
        });

        if (!response.ok) {

            const text = await response.text();
            return {ok: false, error: `API error: ${response.status} ${text}`};

        }

        const data = await response.json() as {error?: {message?: string}; result?: T};

        if (data.error) {

            return {ok: false, error: data.error.message || String(data.error)};

        }

        return {ok: true, data: data.result as T};

    } catch (err) {

        return {ok: false, error: `Request failed: ${err}`};

    }

}

export type LocalDevSession = {
    id: string
    teamId: string
    userId: string
    label: string
    appId: string
    appName: string
    createdAt: string
};

export type Team = {
    id: string
    name: string
};

export async function whoami(): Promise<ApiResponse<{id: string; email: string}>> {

    return apiCall('whoami');

}

export async function getMyTeams(): Promise<ApiResponse<Team[]>> {

    return apiCall('getMyTeams');

}

export async function createLocalDevSession(teamId: string, label: string): Promise<ApiResponse<LocalDevSession>> {

    return apiCall('createLocalDevSession', {teamId, label});

}

export async function getLocalDevSessions(teamId: string): Promise<ApiResponse<LocalDevSession[]>> {

    return apiCall('getLocalDevSessions', {teamId});

}

export async function deleteLocalDevSession(sessionId: string): Promise<ApiResponse<{success: boolean}>> {

    return apiCall('deleteLocalDevSession', {sessionId});

}

export type LogEntry = {
    level?: number | string
    message?: string
    data?: Record<string, unknown>
    time?: string
};

export async function ingestLogs(teamId: string, appId: string, env: string, logs: LogEntry[]): Promise<ApiResponse<{
    success: boolean
    logsIngested: number
}>> {

    return apiCall('ingestLogs', {teamId, appId, env, logs});

}
