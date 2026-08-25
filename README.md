# @logfox/cli

[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue)]()
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![AutoRel](https://img.shields.io/badge/%F0%9F%9A%80%20AutoRel-2D4DDE)](https://github.com/mhweiner/autorel)

CLI tool for sending local development logs to Logfox.

**npm setup:** Uses private `@logfoxai` packages. See [home](https://github.com/logfoxai/home#npm--github-packages-setup) for the one-time npm + gh auth setup.

## Installation

```bash
npm install -g @logfox/cli
```

## Quick Start

```bash
# Authenticate
logfox login

# Run your app with logging
logfox run --name my-app -- npm start
```

Logs appear in Logfox under environment "local".

## Commands

Run `logfox --help` to see all available commands.

## How it Works

1. `logfox run` wraps your command and captures stdout/stderr
2. Logs are parsed (JSON or plain text) and batched
3. Sent to Logfox under environment "local" with app name `local-{hash}-{name}`
4. Issues are detected and grouped just like production logs

### Log Parsing

- **JSON logs** (pino, winston, bunyan): Structure is extracted automatically
- **Plain text**: Log levels detected from common patterns (ERROR, WARN, INFO, DEBUG)

## Configuration

Config is stored in `~/.logfox/config.json`. Use `logfox config` to view current settings.

| Key | Default | Description |
|-----|---------|-------------|
| `apiUrl` | `https://api.logfox.ai` | Logfox API endpoint |
| `appUrl` | `https://app.logfox.ai` | Logfox web app (for login) |
| `teamId` | (from login) | Active team |

### Local Development

To point the CLI at local services:

```bash
logfox config:set apiUrl http://localhost:3000
logfox config:set appUrl http://localhost:4000
logfox login
```

Regenerate the typed API client from a running api-service mount (see [api-service](https://github.com/logfoxai/api-service)):

```bash
npm run generate:api   # default: http://127.0.0.1:3000/v1
LOGFOX_CALLSPEC_URL=https://api.dev.logfox.ai/v1 npm run generate:api
```

`src/generated/api.ts` is gitignored — `prebuild` runs codegen before `tsc`.

## Commits & releases

[AutoRel](https://github.com/mhweiner/autorel). Conventional commits — see the [commit format](https://github.com/mhweiner/autorel/blob/main/docs/commit-format.md).
