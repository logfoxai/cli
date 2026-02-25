#!/usr/bin/env node

import {Command} from 'commander';
import {login} from './commands/login';
import {logout} from './commands/logout';
import {run} from './commands/run';
import {listSessions, deleteSession} from './commands/sessions';
import {listTeams} from './commands/teams';
import {showConfig, getConfigValue, setConfig, resetConfig} from './commands/config';
import {showStatus} from './commands/status';
import {setupCloudwatch} from './commands/setup-cloudwatch';
import {updateCloudwatch} from './commands/update-cloudwatch';
import {cloudwatchRemove} from './commands/cloudwatch-remove';

const program = new Command();

program
    .name('logfox')
    .description('Logfox CLI for log collection and local development')
    .version('0.0.1');

program
    .command('login')
    .description('Log in to Logfox')
    .action(login);

program
    .command('logout')
    .description('Log out of Logfox')
    .action(logout);

program
    .command('status')
    .description('Show current login status')
    .action(showStatus);

program
    .command('run')
    .description('Run a command and send logs to Logfox')
    .requiredOption('-n, --name <name>', 'Name for this app (e.g., "backend", "api")')
    .option('-e, --env <env>', 'Environment (default: local)', 'local')
    .argument('<command...>', 'Command to run')
    .allowExcessArguments(true)
    .action((command: string[], options: {name: string; env: string}) => {

        void run(command, options);

    });

program
    .command('teams')
    .description('List your teams')
    .action(listTeams);

program
    .command('apps')
    .description('List your local dev apps')
    .action(listSessions);

program
    .command('delete')
    .description('Delete a local dev app')
    .argument('<appId>', 'App ID to delete')
    .action(deleteSession);

program
    .command('config')
    .description('Show current configuration and available options')
    .action(() => showConfig());

program
    .command('config:get <key>')
    .description('Get a config value')
    .action((key: string) => getConfigValue(key));

program
    .command('config:set <key> <value>')
    .description('Set a config value')
    .action((key: string, value: string) => setConfig(key, value));

program
    .command('config:reset')
    .description('Reset configuration to defaults (production)')
    .action(() => resetConfig());

// CloudWatch commands
const setupCmd = program
    .command('setup')
    .description('Setup integrations');

setupCmd
    .command('cloudwatch')
    .description('Setup CloudWatch log forwarding to Logfox')
    .action(() => void setupCloudwatch());

const updateCmd = program
    .command('update')
    .description('Update integrations');

updateCmd
    .command('cloudwatch')
    .description('Update the Logfox Forwarder Lambda to the latest version')
    .action(() => void updateCloudwatch());

program
    .command('cloudwatch')
    .description('CloudWatch management commands')
    .command('remove')
    .description('Remove CloudWatch subscription filters')
    .action(() => void cloudwatchRemove());

program.parse();
