import * as http from 'http';
import * as url from 'url';
import {saveConfig, getConfig} from '../config';
import * as api from '../api';

const AUTH_CALLBACK_PORT = 9876;

export async function login(): Promise<void> {

    const config = getConfig();

    // Check if already logged in
    if (config.authToken) {

        const result = await api.whoami();

        if (result.ok) {

            console.log(`Already logged in as ${result.data.email}`);
            console.log('Run "logspace logout" to sign out first.');
            return;

        }

    }

    console.log('Opening browser to log in...');
    console.log('(If browser does not open, visit the URL manually)');
    console.log();

    // Determine the login URL based on API URL
    const baseUrl = config.apiUrl.replace('/api', '');
    const loginUrl = `${baseUrl}/cli-login?port=${AUTH_CALLBACK_PORT}`;

    console.log(`Login URL: ${loginUrl}`);
    console.log();

    // Open browser
    try {

        const open = (await import('open')).default;
        await open(loginUrl);

    } catch {

        console.log('Could not open browser automatically.');

    }

    // Start local server to receive callback
    const token = await waitForAuthCallback();

    if (!token) {

        console.error('Login failed: No token received');
        process.exit(1);

    }

    saveConfig({authToken: token});

    // Verify login worked
    const result = await api.whoami();

    if (result.ok) {

        console.log(`Logged in as ${result.data.email}`);
        saveConfig({userId: result.data.id});

        // Get teams and save the first one as default
        const teamsResult = await api.getMyTeams();

        if (teamsResult.ok && teamsResult.data.length > 0) {

            const team = teamsResult.data[0];
            saveConfig({teamId: team.id});
            console.log(`Default team: ${team.name}`);

        }

    } else {

        console.error('Login verification failed:', result.error);
        process.exit(1);

    }

}

function waitForAuthCallback(): Promise<string | null> {

    return new Promise((resolve) => {

        const server = http.createServer((req, res) => {

            const parsedUrl = url.parse(req.url || '', true);

            if (parsedUrl.pathname === '/callback') {

                const token = parsedUrl.query.token as string;

                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(`
                    <html>
                    <head><title>Logspace CLI</title></head>
                    <body style="font-family: system-ui; text-align: center; padding: 50px;">
                        <h1>Login Successful!</h1>
                        <p>You can close this window and return to the terminal.</p>
                    </body>
                    </html>
                `);

                server.close();
                resolve(token || null);

            } else {

                res.writeHead(404);
                res.end('Not found');

            }

        });

        server.listen(AUTH_CALLBACK_PORT, () => {

            console.log(`Waiting for login callback on port ${AUTH_CALLBACK_PORT}...`);

        });

        // Timeout after 5 minutes
        setTimeout(() => {

            server.close();
            resolve(null);

        }, 5 * 60 * 1000);

    });

}
