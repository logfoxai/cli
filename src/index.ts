#!/usr/bin/env node

import {Command} from 'commander';
import {login} from './commands/login';
import {logout} from './commands/logout';
import {run} from './commands/run';
import {listSessions, deleteSession} from './commands/sessions';
import {showConfig, setConfig} from './commands/config';

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
    .command('run')
    .description('Run a command and send logs to Logspace')
    .requiredOption('-n, --name <name>', 'Name for this local app (e.g., "backend", "frontend")')
    .argument('<command...>', 'Command to run')
    .allowExcessArguments(true)
    .action((command: string[], options: {name: string}) => {

        run(command, options);

    });

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
    .description('Show or set configuration')
    .argument('[key]', 'Config key to set (apiUrl or appUrl)')
    .argument('[value]', 'Value to set')
    .action((key?: string, value?: string) => {

        if (!key) {

            showConfig();

        } else if (!value) {

            console.error('Usage: logspace config <key> <value>');
            console.log('Example: logspace config apiUrl http://localhost:4000/api');
            process.exit(1);

        } else {

            setConfig(key, value);

        }

    });

program.parse();
