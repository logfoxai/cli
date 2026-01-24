# Logspace CLI

CLI tool for sending local development logs to Logspace.

## Installation

```bash
npm install -g @logspacehq/cli
```

## Usage

### Login

First, authenticate with your Logspace account:

```bash
logspace login
```

This will open a browser window for you to log in. Once authenticated, you can close the browser and return to the terminal.

### Run a command

Run any command and have its output sent to Logspace:

```bash
logspace run --name my-backend -- npm start
```

The `--name` flag specifies the name of your local app. This helps you identify which app the logs are coming from in the Logspace dashboard.

Examples:

```bash
# Run a Node.js server
logspace run --name api-server -- npm run dev

# Run a Python script
logspace run --name data-processor -- python main.py

# Run with environment variables
logspace run --name frontend -- npm start
```

### View your local apps

List all your local dev apps:

```bash
logspace apps
```

### Delete a local app

Delete a local app (logs will remain):

```bash
logspace delete <appId>
```

### Logout

```bash
logspace logout
```

## How it works

1. When you run `logspace run`, the CLI creates a local dev session with a unique app name (e.g., `local-backend-a1b2c3`)
2. Your command is spawned as a child process
3. stdout and stderr are captured, parsed, and sent to Logspace
4. Logs appear in the Logspace dashboard under environment "local"
5. Issues are detected and grouped just like production logs

## Log parsing

The CLI attempts to parse log output intelligently:

- **JSON logs**: If your app outputs JSON logs (like pino, winston, bunyan), the CLI will parse the structure and extract level, message, and additional data
- **Plain text**: For plain text logs, the CLI detects log levels from common patterns (ERROR, WARN, INFO, DEBUG)

## Configuration

Configuration is stored in `~/.logspace/config.json`:

```json
{
  "authToken": "your-auth-token",
  "apiUrl": "https://api.logspace.sh/api",
  "teamId": "your-team-id"
}
```
