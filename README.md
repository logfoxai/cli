# @logfoxai/cli

[![build status](https://github.com/logfoxai/cli/actions/workflows/release.yml/badge.svg)](https://github.com/logfoxai/cli/actions)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue)]()
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![AutoRel](https://img.shields.io/badge/v2-AutoRel?label=AutoRel&labelColor=0ab5fc&color=grey&link=https%3A%2F%2Fgithub.com%2Fmhweiner%2Fautorel)](https://github.com/mhweiner/autorel)

CLI tool for sending local development logs to Logfox.

## Installation

```bash
npm install -g @logfoxai/cli
```

## Quick Start

```bash
# Authenticate
logspace login

# Run your app with logging
logspace run --name my-app -- npm start
```

Logs appear in Logfox under environment "local".

## Commands

Run `logspace --help` to see all available commands.

## How it Works

1. `logspace run` wraps your command and captures stdout/stderr
2. Logs are parsed (JSON or plain text) and batched
3. Sent to Logfox under environment "local" with app name `local-{hash}-{name}`
4. Issues are detected and grouped just like production logs

### Log Parsing

- **JSON logs** (pino, winston, bunyan): Structure is extracted automatically
- **Plain text**: Log levels detected from common patterns (ERROR, WARN, INFO, DEBUG)

## Configuration

Config is stored in `~/.logfox/config.json`. Use `logspace config` to view current settings.

| Key | Default | Description |
|-----|---------|-------------|
| `apiUrl` | `https://api.logfox.ai` | Logfox API endpoint |
| `appUrl` | `https://app.logfox.ai` | Logfox web app (for login) |
| `teamId` | (from login) | Active team |

### Local Development

To point the CLI at local services:

```bash
logspace config:set apiUrl http://localhost:3000
logspace config:set appUrl http://localhost:4000
logspace login
```
