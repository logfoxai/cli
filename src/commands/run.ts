/* eslint-disable max-lines-per-function */
import {spawn} from 'child_process';
import {createHash} from 'crypto';
import {getConfig} from '../config';
import * as api from '../api';
import type {LogEntry, App} from '../api';

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 3000; // 3s

type RunOptions = {
    name: string
    env: string
};

function generateUserHash(userId: string): string {

    return createHash('sha256').update(userId).digest('hex').slice(0, 4);

}

export async function run(command: string[], options: RunOptions): Promise<void> {

    const config = getConfig();
    const env = options.env || 'local';
    const isLocal = env === 'local';

    // For non-local environments, we require API key auth
    if (!isLocal) {

        if (!config.apiKey) {

            console.error('API key not configured. Run "logfox config:set apiKey <your-api-key>" first.');
            console.error('You can find your API key in the Logfox dashboard under Settings.');
            process.exit(1);

        }

    } else {

        // For local, we still support the old auth token flow
        if (!config.authToken) {

            console.error('Not logged in. Run "logfox login" first.');
            process.exit(1);

        }

        if (!config.teamId) {

            console.error('No team configured. Run "logfox login" first.');
            process.exit(1);

        }

        if (!config.userId) {

            console.error('User ID not found. Run "logfox logout" then "logfox login" again.');
            process.exit(1);

        }

    }

    if (!options.name) {

        console.error('Please provide an app name with --name');
        process.exit(1);

    }

    if (command.length === 0) {

        console.error('Please provide a command to run');
        console.error('Example: logfox run --name my-app -- npm start');
        process.exit(1);

    }

    // Build app name - for local, use deterministic name with user hash
    const label = options.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    let appName: string;

    if (isLocal && config.userId) {

        const userHash = generateUserHash(config.userId);
        appName = `local-${userHash}-${label}`;

    } else {

        appName = label;

    }

    console.log(`Setting up app "${appName}" for env "${env}"...`);

    // For local env with auth token, create/find app via API
    let app: App | undefined;

    if (isLocal && config.teamId) {

        // Search for existing app
        const searchResult = await api.searchApps({teamId: config.teamId, name: appName});

        if (searchResult.ok && searchResult.data.length > 0) {

            app = searchResult.data[0];
            console.log(`Found existing app: ${app.name}`);

        } else {

            // Create new app
            const createResult = await api.createApp({teamId: config.teamId, name: appName});

            if (!createResult.ok) {

                console.error('Failed to create local app:', createResult.error);
                process.exit(1);

            }

            app = createResult.data;
            console.log(`Created new app: ${app.name}`);

        }

    }

    console.log(`Logs will appear in Logfox under env "${env}", app "${appName}"`);
    console.log();

    // Start the child process
    const [cmd, ...args] = command;
    const child = spawn(cmd, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true,
        env: {
            ...process.env,
            LOGFOX_APP_ID: app?.id || appName,
            LOGFOX_APP_NAME: appName,
            LOGFOX_ENV: env,
        },
    });

    // Buffer for batching logs
    let logBuffer: LogEntry[] = [];
    let flushTimeout: NodeJS.Timeout | null = null;

    async function flushLogs(): Promise<void> {

        if (logBuffer.length === 0) return;

        const logsToSend = logBuffer;
        logBuffer = [];

        const appId = app?.id ?? appName;

        const result = await api.ingestLogs(appId, env, logsToSend, 'cli');

        if (!result.ok) {

            console.error(`[logfox] Failed to send logs: ${result.error}`);

        }

    }

    function scheduleFlush(): void {

        if (flushTimeout) return;

        flushTimeout = setTimeout(async () => {

            flushTimeout = null;
            await flushLogs();

        }, FLUSH_INTERVAL_MS);

    }

    function addLog(line: string, isError: boolean): void {

        // Also print to console so user sees output
        if (isError) {

            process.stderr.write(line + '\n');

        } else {

            process.stdout.write(line + '\n');

        }

        // Try to parse as JSON
        const logEntry = parseLogLine(line, isError);
        logBuffer.push(logEntry);

        // Flush if buffer is full
        if (logBuffer.length >= BATCH_SIZE) {

            void flushLogs();

        } else {

            scheduleFlush();

        }

    }

    // Handle stdout
    let stdoutBuffer = '';
    child.stdout?.on('data', (data: Buffer) => {

        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {

            if (line.trim()) addLog(line, false);

        }

    });

    // Handle stderr
    let stderrBuffer = '';
    child.stderr?.on('data', (data: Buffer) => {

        stderrBuffer += data.toString();
        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() || '';

        for (const line of lines) {

            if (line.trim()) addLog(line, true);

        }

    });

    // Handle process exit
    child.on('close', async (code) => {

        // Flush remaining buffer content
        if (stdoutBuffer.trim()) addLog(stdoutBuffer, false);
        if (stderrBuffer.trim()) addLog(stderrBuffer, true);

        // Final flush
        await flushLogs();

        console.log();
        console.log(`Process exited with code ${code}`);
        process.exit(code || 0);

    });

    // Handle signals
    process.on('SIGINT', () => {

        child.kill('SIGINT');

    });

    process.on('SIGTERM', () => {

        child.kill('SIGTERM');

    });

}

function parseLogLine(line: string, isError: boolean): LogEntry {

    const now = Date.now();

    // Try to parse as JSON first (for structured logging)
    try {

        const parsed = JSON.parse(line);

        if (typeof parsed === 'object' && parsed !== null) {

            const rawLevel = parsed.level ?? parsed.severity ?? (isError ? 'error' : 'info');
            const rawTime = parsed.time ?? parsed.timestamp;

            return {
                level: normalizeLevel(rawLevel, isError),
                message: parsed.message ?? parsed.msg ?? line,
                data: excludeKeys(parsed, ['level', 'severity', 'message', 'msg', 'time', 'timestamp']),
                timestamp: normalizeTimestamp(rawTime) ?? now,
            };

        }

    } catch {
        // Not JSON, continue
    }

    // Detect log level from common patterns
    const level = detectLogLevel(line, isError);

    return {
        level: normalizeLevel(level, isError),
        message: line,
        timestamp: now,
    };

}

// Convert level to numeric value (matches standard syslog/bunyan levels)
function normalizeLevel(level: unknown, isError: boolean): number {

    if (typeof level === 'number') return level;

    const str = String(level).toLowerCase();

    if (str === 'trace') return 10;
    if (str === 'debug') return 20;
    if (str === 'info') return 30;
    if (str === 'warn' || str === 'warning') return 40;
    if (str === 'error' || str === 'err') return 50;
    if (str === 'fatal' || str === 'panic') return 60;

    return isError ? 50 : 30;

}

// Convert timestamp to unix milliseconds
function normalizeTimestamp(time: unknown): number | undefined {

    if (typeof time === 'number') {

        // If looks like seconds, convert to ms
        if (time < 1e12) return time * 1000;
        return time;

    }

    if (typeof time === 'string') {

        const ms = Date.parse(time);
        if (!isNaN(ms)) return ms;

    }

    return undefined;

}

function detectLogLevel(line: string, isError: boolean): string {

    const lower = line.toLowerCase();

    // Check for common log level patterns
    if (/\b(error|err|fatal|panic)\b/i.test(lower)) return 'error';
    if (/\b(warn|warning)\b/i.test(lower)) return 'warn';
    if (/\b(debug|trace)\b/i.test(lower)) return 'debug';
    if (/\b(info)\b/i.test(lower)) return 'info';

    // Default based on stream
    return isError ? 'error' : 'info';

}

function excludeKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined {

    const result: Record<string, unknown> = {};
    let hasKeys = false;

    for (const [key, value] of Object.entries(obj)) {

        if (!keys.includes(key)) {

            result[key] = value;
            hasKeys = true;

        }

    }

    return hasKeys ? result : undefined;

}
