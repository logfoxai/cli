#!/usr/bin/env node

import {Command} from 'commander';
import {login} from './commands/login';
import {logout} from './commands/logout';
import {run} from './commands/run';
import {listSessions, deleteSession} from './commands/sessions';
import {listTeams} from './commands/teams';
import {showConfig, getConfigValue, setConfig, resetConfig} from './commands/config';
import {showStatus} from './commands/status';

const program = new Command();

program
    .name('logspace')
    .description('Logspace CLI for local development logging')
    .version('0.0.1');

program
    .command('login')
    .description('Log in to Logspace')
    .action(login);

program
    .command('logout')
    .description('Log out of Logspace')
    .action(logout);

program
    .command('status')
    .description('Show current login status')
    .action(showStatus);

program
    .command('run')
    .description('Run a command and send logs to Logspace')
    .requiredOption('-n, --name <name>', 'Name for this local app (e.g., "backend", "frontend")')
    .argument('<command...>', 'Command to run')
    .allowExcessArguments(true)
    .action((command: string[], options: {name: string}) => {

        run(command, options);

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

program.parse();
