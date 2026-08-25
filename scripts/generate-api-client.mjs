#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'src/generated/api.ts');
const cli = join(root, 'node_modules/callspec/dist/cli/generate-client.js');
const siblingCallspec = join(root, '../api-service/callspec.json');

function resolveSource() {

    if (process.env.LOGFOX_CALLSPEC_URL) return process.env.LOGFOX_CALLSPEC_URL;

    if (process.env.LOGFOX_CALLSPEC_PATH) return process.env.LOGFOX_CALLSPEC_PATH;

    if (existsSync(siblingCallspec)) return siblingCallspec;

    return undefined;

}

const source = resolveSource();

if (!source) {

    if (existsSync(output)) {

        console.log('Skipping API codegen — no callspec source and generated client exists');
        process.exit(0);

    }

    console.error('No callspec source. Set LOGFOX_CALLSPEC_PATH or LOGFOX_CALLSPEC_URL, or clone api-service beside cli.');
    process.exit(1);

}

const result = spawnSync(process.execPath, [cli, source, '--output', output], {
    cwd: root,
    stdio: 'inherit',
});

if (result.status !== 0) {

    process.exit(result.status ?? 1);

}

console.log(`Wrote ${output} from ${source}`);
