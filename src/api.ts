import {
    ApiClient,
    App,
    IngestLogsInput,
    IngestLogsInputLogsItem,
    Team,
} from './generated/api';
import {getConfig} from './config';

export type {App, Team};

export type LogEntry = IngestLogsInputLogsItem & {
    data?: Record<string, unknown>
};

type ApiResponse<T> = {
    ok: true
    data: T
} | {
    ok: false
    error: string
};

export type Collector = 'cli' | 'cloudwatch-logs' | 'sdk' | 'vercel' | 'fluentbit';

function createClient(): ApiClient | undefined {

    const config = getConfig();
    const bearer = config.apiKey ?? config.authToken;

    if (!bearer) return undefined;

    return new ApiClient({
        baseUrl: config.apiUrl,
        headers: {
            Authorization: `Bearer ${bearer}`,
            'Content-Type': 'application/json',
        },
    });

}

function formatError(code: string, data?: unknown): string {

    if (data && typeof data === 'object' && data !== null && 'message' in data) {

        const message = (data as {message?: string}).message;

        if (message) return message;

    }

    return code;

}

function notLoggedIn(): ApiResponse<never> {

    return {ok: false, error: 'Not logged in. Run: logfox login or: logfox config set apiKey <key>'};

}

function normalizeEnv(env: string): IngestLogsInput['env'] {

    if (env === 'prod') return 'production';
    if (env === 'dev') return 'development';

    return env as IngestLogsInput['env'];

}

export async function whoami(): Promise<ApiResponse<{id: string; email: string}>> {

    const client = createClient();

    if (!client) return notLoggedIn();

    const result = await client.whoami();

    if (result.ok) return {ok: true, data: result.value.user};

    return {ok: false, error: formatError(result.code, 'data' in result ? result.data : undefined)};

}

export async function getMyTeams(): Promise<ApiResponse<Team[]>> {

    const client = createClient();

    if (!client) return notLoggedIn();

    const result = await client.getMyTeams();

    if (result.ok) return {ok: true, data: result.value};

    return {ok: false, error: formatError(result.code, 'data' in result ? result.data : undefined)};

}

export async function searchApps(params: {
    teamId: string
    name?: string
    createdByUserId?: string
}): Promise<ApiResponse<App[]>> {

    const client = createClient();

    if (!client) return notLoggedIn();

    const result = await client.searchApps(params);

    if (result.ok) return {ok: true, data: result.value};

    return {ok: false, error: formatError(result.code, 'data' in result ? result.data : undefined)};

}

export async function createApp(params: {teamId: string; name: string}): Promise<ApiResponse<App>> {

    const client = createClient();

    if (!client) return notLoggedIn();

    const result = await client.createApp(params);

    if (result.ok) return {ok: true, data: result.value};

    return {ok: false, error: formatError(result.code, 'data' in result ? result.data : undefined)};

}

export async function deleteApp(appId: string, teamId: string): Promise<ApiResponse<void>> {

    const client = createClient();

    if (!client) return notLoggedIn();

    const result = await client.deleteApp({appId, teamId});

    if (result.ok) return {ok: true, data: undefined};

    return {ok: false, error: formatError(result.code, 'data' in result ? result.data : undefined)};

}

export async function ingestLogs(
    appId: string,
    env: string,
    logs: LogEntry[],
    collector?: Collector,
): Promise<ApiResponse<{
    success: boolean
    logsIngested: number
}>> {

    const client = createClient();

    if (!client) return notLoggedIn();

    const result = await client.ingestLogs({
        appId,
        env: normalizeEnv(env),
        logs,
        collector,
    });

    if (result.ok) return {ok: true, data: result.value};

    if (result.code === 'LOG_INGEST_FAILED') {

        return {ok: false, error: result.data.error};

    }

    return {ok: false, error: formatError(result.code, 'data' in result ? result.data : undefined)};

}
