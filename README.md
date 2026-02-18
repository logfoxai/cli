# Logspace CLI

CLI tool for sending local development logs to Logspace.

## Installation

```bash
npm install -g @logspacehq/cli
```

## Quick Start

```bash
# Authenticate
logspace login

# Run your app with logging
logspace run --name my-app -- npm start
```

Logs appear in Logspace under environment "local".

## Commands

Run `logspace --help` to see all available commands.

## How it Works

1. `logspace run` wraps your command and captures stdout/stderr
2. Logs are parsed (JSON or plain text) and batched
3. Sent to Logspace under environment "local" with app name `local-{hash}-{name}`
4. Issues are detected and grouped just like production logs

### Log Parsing

- **JSON logs** (pino, winston, bunyan): Structure is extracted automatically
- **Plain text**: Log levels detected from common patterns (ERROR, WARN, INFO, DEBUG)

## Configuration

Config is stored in `~/.logspace/config.json`. Use `logspace config` to view current settings.

| Key | Default | Description |
|-----|---------|-------------|
| `apiUrl` | `https://api.logspace.sh` | Logspace API endpoint |
| `appUrl` | `https://app.logspace.sh` | Logspace web app (for login) |
| `teamId` | (from login) | Active team |

### Local Development

To point the CLI at local services:

```bash
logspace config:set apiUrl http://localhost:3000
logspace config:set appUrl http://localhost:4000
logspace login
```
