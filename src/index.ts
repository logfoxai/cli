#!/usr/bin/env node

import {Command} from 'commander';
import {login} from './commands/login';
import {logout} from './commands/logout';
import {run} from './commands/run';
import {listSessions, deleteSession} from './commands/sessions';

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
    .command('sessions')
    .description('List your local dev sessions')
    .action(listSessions);

program
    .command('delete-session')
    .description('Delete a local dev session')
    .argument('<sessionId>', 'Session ID to delete')
    .action(deleteSession);

program.parse();
