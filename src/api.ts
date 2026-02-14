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

        // express-typed-rpc expects method name in URL path, args as body
        const response = await fetch(`${config.apiUrl}/${method}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.authToken}`,
            },
            body: JSON.stringify(body ?? {}),
        });

        if (!response.ok) {

            const text = await response.text();
            return {ok: false, error: `API error: ${response.status} ${text}`};

        }

        const data = await response.json() as T & {error?: {message?: string}};

        if ('error' in data && data.error) {

            return {ok: false, error: data.error.message || String(data.error)};

        }

        return {ok: true, data};

    } catch (err) {

        return {ok: false, error: `Request failed: ${err}`};

    }

}

export type App = {
    id: string
    teamId: string
    name: string
    createdByUserId?: string
    createdAt: string | {__type: string; value: string}
    updatedAt: string | {__type: string; value: string}
};

export type Team = {
    id: string
    name: string
};

export async function whoami(): Promise<ApiResponse<{id: string; email: string}>> {

    const result = await apiCall<{user: {id: string; email: string}}>('whoami');

    if (!result.ok) return result;

    return {ok: true, data: result.data.user};

}

export async function getMyTeams(): Promise<ApiResponse<Team[]>> {

    return apiCall('getMyTeams');

}

export async function searchApps(params: {teamId: string; name?: string; createdByUserId?: string}): Promise<ApiResponse<App[]>> {

    return apiCall('searchApps', params);

}

export async function createApp(params: {teamId: string; name: string}): Promise<ApiResponse<App>> {

    return apiCall('createApp', params);

}

export async function deleteApp(appId: string, teamId: string): Promise<ApiResponse<void>> {

    return apiCall('deleteApp', {appId, teamId});

}

export type LogEntry = {
    timestamp: number
    level?: number
    message: string
    data?: Record<string, unknown>
};

export async function ingestLogs(teamId: string, appId: string, env: string, logs: LogEntry[]): Promise<ApiResponse<{
    success: boolean
    logsIngested: number
}>> {

    return apiCall('ingestLogs', {teamId, appId, env, logs});

}
