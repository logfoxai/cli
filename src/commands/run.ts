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
};

function generateUserHash(userId: string): string {

    return createHash('sha256').update(userId).digest('hex').slice(0, 4);

}

export async function run(command: string[], options: RunOptions): Promise<void> {

    const config = getConfig();

    if (!config.authToken) {

        console.error('Not logged in. Run "logspace login" first.');
        process.exit(1);

    }

    if (!config.teamId) {

        console.error('No team configured. Run "logspace login" first.');
        process.exit(1);

    }

    if (!config.userId) {

        console.error('User ID not found. Run "logspace logout" then "logspace login" again.');
        process.exit(1);

    }

    if (!options.name) {

        console.error('Please provide an app name with --name');
        process.exit(1);

    }

    if (command.length === 0) {

        console.error('Please provide a command to run');
        console.error('Example: logspace run --name my-app -- npm start');
        process.exit(1);

    }

    // Build deterministic app name: local-{hash}-{label}
    const userHash = generateUserHash(config.userId);
    const label = options.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const appName = `local-${userHash}-${label}`;

    console.log(`Setting up local app "${appName}"...`);

    // Search for existing app
    const searchResult = await api.searchApps({teamId: config.teamId, name: appName});

    let app: App;

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

    console.log(`Logs will appear in Logspace under env "local", app "${app.name}"`);
    console.log();

    // Start the child process
    const [cmd, ...args] = command;
    const child = spawn(cmd, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true,
        env: {
            ...process.env,
            LOGSPACE_APP_ID: app.id,
            LOGSPACE_APP_NAME: app.name,
        },
    });

    // Buffer for batching logs
    let logBuffer: LogEntry[] = [];
    let flushTimeout: NodeJS.Timeout | null = null;

    async function flushLogs(): Promise<void> {

        if (logBuffer.length === 0) return;

        const logsToSend = logBuffer;
        logBuffer = [];

        const result = await api.ingestLogs(config.teamId!, app.id, 'local', logsToSend);

        if (!result.ok) {

            console.error(`[logspace] Failed to send logs: ${result.error}`);

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

            flushLogs();

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

    // Try to parse as JSON first (for structured logging)
    try {

        const parsed = JSON.parse(line);

        if (typeof parsed === 'object' && parsed !== null) {

            return {
                level: parsed.level ?? parsed.severity ?? (isError ? 'error' : 'info'),
                message: parsed.message ?? parsed.msg ?? line,
                data: excludeKeys(parsed, ['level', 'severity', 'message', 'msg', 'time', 'timestamp']),
                time: parsed.time ?? parsed.timestamp ?? new Date().toISOString(),
            };

        }

    } catch {
        // Not JSON, continue
    }

    // Detect log level from common patterns
    const level = detectLogLevel(line, isError);

    return {
        level,
        message: line,
        time: new Date().toISOString(),
    };

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
