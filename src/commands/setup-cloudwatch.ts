/* eslint-disable max-lines-per-function */
import {STSClient, GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    PutSubscriptionFilterCommand,
    LogGroup,
} from '@aws-sdk/client-cloudwatch-logs';
import {
    LambdaClient,
    CreateFunctionCommand,
    GetFunctionCommand,
    UpdateFunctionConfigurationCommand,
    AddPermissionCommand,
    ResourceConflictException,
} from '@aws-sdk/client-lambda';
import {
    IAMClient,
    CreateRoleCommand,
    AttachRolePolicyCommand,
    GetRoleCommand,
    EntityAlreadyExistsException,
} from '@aws-sdk/client-iam';
import {input, checkbox, confirm} from '@inquirer/prompts';
import {getConfig, saveConfig} from '../config';

const FORWARDER_LAMBDA_NAME = 'LogfoxForwarder';
const FORWARDER_ROLE_NAME = 'LogfoxForwarderRole';
const FORWARDER_S3_BUCKET = 'logfox-public-assets';
const FORWARDER_S3_KEY = 'forwarder/v1/forwarder.zip';

interface LogGroupMapping {
    logGroup: string;
    appName: string;
    env: string;
}

export async function setupCloudwatch(): Promise<void> {

    const config = getConfig();

    console.log('Logfox CloudWatch Setup');
    console.log('=======================');
    console.log();

    // 1. Check AWS credentials
    console.log('Checking AWS credentials...');

    const sts = new STSClient({});
    let accountId: string;
    let region: string;

    try {

        const identity = await sts.send(new GetCallerIdentityCommand({}));
        accountId = identity.Account!;
        region = await sts.config.region() as string;
        console.log(`✓ Using AWS account ${accountId} (${region})`);

    } catch (error) {

        console.error('✗ Failed to get AWS credentials.');
        console.error('  Make sure you have AWS credentials configured.');
        console.error('  Run: aws configure');
        process.exit(1);

    }

    console.log();

    // 2. Get or prompt for API key
    let apiKey = config.apiKey;

    if (!apiKey) {

        apiKey = await input({
            message: 'Enter your Logfox API key:',
            validate: (value) => value.length > 0 || 'API key is required',
        });

        saveConfig({apiKey});
        console.log('✓ API key saved');

    } else {

        console.log(`✓ Using saved API key`);

    }

    console.log();

    // 3. List log groups
    console.log('Scanning for log groups...');

    const logsClient = new CloudWatchLogsClient({});
    const logGroups: LogGroup[] = [];
    let nextToken: string | undefined;

    do {

        const response = await logsClient.send(new DescribeLogGroupsCommand({nextToken}));
        logGroups.push(...(response.logGroups || []));
        nextToken = response.nextToken;

    } while (nextToken);

    if (logGroups.length === 0) {

        console.log('No log groups found in this region.');
        console.log('Make sure you have CloudWatch log groups to monitor.');
        process.exit(1);

    }

    console.log(`Found ${logGroups.length} log groups in ${region}`);
    console.log();

    // 4. Let user select log groups
    const selectedLogGroups = await checkbox({
        message: 'Select log groups to monitor:',
        choices: logGroups.map((lg) => ({
            name: lg.logGroupName!,
            value: lg.logGroupName!,
        })),
        pageSize: 15,
    });

    if (selectedLogGroups.length === 0) {

        console.log('No log groups selected. Exiting.');
        process.exit(0);

    }

    console.log();

    // 5. Configure app/env mapping for each log group
    console.log('Configure log routing:');
    console.log('(For each log group, specify the app name and environment)');
    console.log();

    const mappings: LogGroupMapping[] = [];

    for (const logGroup of selectedLogGroups) {

        // Try to suggest app name from log group name
        const suggestedApp = suggestAppName(logGroup);

        const appName = await input({
            message: `${logGroup} → App name:`,
            default: suggestedApp,
            validate: (value) => value.length > 0 || 'App name is required',
        });

        const env = await input({
            message: `${logGroup} → Environment:`,
            default: suggestEnv(logGroup),
            validate: (value) => value.length > 0 || 'Environment is required',
        });

        mappings.push({logGroup, appName, env});

    }

    console.log();

    // 6. Confirm
    console.log('Summary:');

    for (const m of mappings) {

        console.log(`  ${m.logGroup} → ${m.appName} (${m.env})`);

    }

    console.log();

    const proceed = await confirm({
        message: 'Deploy Logfox Forwarder Lambda?',
        default: true,
    });

    if (!proceed) {

        console.log('Setup cancelled.');
        process.exit(0);

    }

    console.log();

    // 7. Create IAM role
    console.log('Setting up IAM role...');

    const iamClient = new IAMClient({});
    let roleArn: string;

    try {

        const existingRole = await iamClient.send(new GetRoleCommand({RoleName: FORWARDER_ROLE_NAME}));
        roleArn = existingRole.Role!.Arn!;
        console.log(`✓ Using existing IAM role: ${FORWARDER_ROLE_NAME}`);

    } catch {

        try {

            const createRoleResult = await iamClient.send(new CreateRoleCommand({
                RoleName: FORWARDER_ROLE_NAME,
                AssumeRolePolicyDocument: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {Service: 'lambda.amazonaws.com'},
                        Action: 'sts:AssumeRole',
                    }],
                }),
                Description: 'IAM role for Logfox Forwarder Lambda',
            }));

            roleArn = createRoleResult.Role!.Arn!;

            // Attach basic execution policy
            await iamClient.send(new AttachRolePolicyCommand({
                RoleName: FORWARDER_ROLE_NAME,
                PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
            }));

            console.log(`✓ Created IAM role: ${FORWARDER_ROLE_NAME}`);

            // Wait for role to propagate
            console.log('  Waiting for role to propagate...');
            await sleep(10000);

        } catch (error) {

            if (error instanceof EntityAlreadyExistsException) {

                const existingRole = await iamClient.send(new GetRoleCommand({RoleName: FORWARDER_ROLE_NAME}));
                roleArn = existingRole.Role!.Arn!;
                console.log(`✓ Using existing IAM role: ${FORWARDER_ROLE_NAME}`);

            } else {

                throw error;

            }

        }

    }

    // 8. Create or update Lambda function
    console.log('Setting up Lambda function...');

    const lambdaClient = new LambdaClient({});
    const logGroupMappings: Record<string, {appId: string; env: string}> = {};

    for (const m of mappings) {

        logGroupMappings[m.logGroup] = {appId: m.appName, env: m.env};

    }

    const lambdaEnv = {
        LOGFOX_ENDPOINT: `${config.apiUrl}/v1/ingestLogs`,
        LOGFOX_API_KEY: apiKey,
        LOG_GROUP_MAPPINGS: JSON.stringify(logGroupMappings),
    };

    let lambdaArn: string;

    try {

        // Check if Lambda exists
        const existingLambda = await lambdaClient.send(new GetFunctionCommand({
            FunctionName: FORWARDER_LAMBDA_NAME,
        }));

        lambdaArn = existingLambda.Configuration!.FunctionArn!;

        // Update environment variables
        await lambdaClient.send(new UpdateFunctionConfigurationCommand({
            FunctionName: FORWARDER_LAMBDA_NAME,
            Environment: {Variables: lambdaEnv},
        }));

        console.log(`✓ Updated existing Lambda: ${FORWARDER_LAMBDA_NAME}`);

    } catch {

        // Create new Lambda
        try {

            const createResult = await lambdaClient.send(new CreateFunctionCommand({
                FunctionName: FORWARDER_LAMBDA_NAME,
                Runtime: 'nodejs20.x',
                Role: roleArn,
                Handler: 'index.handler',
                Code: {
                    S3Bucket: FORWARDER_S3_BUCKET,
                    S3Key: FORWARDER_S3_KEY,
                },
                Environment: {Variables: lambdaEnv},
                Timeout: 30,
                MemorySize: 128,
                Description: 'Forwards CloudWatch logs to Logfox',
            }));

            lambdaArn = createResult.FunctionArn!;
            console.log(`✓ Created Lambda: ${FORWARDER_LAMBDA_NAME}`);

        } catch (error) {

            if (error instanceof ResourceConflictException) {

                // Lambda is being created, wait and retry
                console.log('  Lambda is being created, waiting...');
                await sleep(5000);
                const existingLambda = await lambdaClient.send(new GetFunctionCommand({
                    FunctionName: FORWARDER_LAMBDA_NAME,
                }));
                lambdaArn = existingLambda.Configuration!.FunctionArn!;

            } else {

                throw error;

            }

        }

    }

    // 9. Create subscription filters
    console.log('Creating subscription filters...');

    for (const m of mappings) {

        try {

            // Add permission for CloudWatch Logs to invoke Lambda
            try {

                await lambdaClient.send(new AddPermissionCommand({
                    FunctionName: FORWARDER_LAMBDA_NAME,
                    StatementId: `logfox-${m.logGroup.replace(/\//g, '-').replace(/^-/, '')}`,
                    Action: 'lambda:InvokeFunction',
                    Principal: 'logs.amazonaws.com',
                    SourceArn: `arn:aws:logs:${region}:${accountId}:log-group:${m.logGroup}:*`,
                }));

            } catch {
                // Permission may already exist
            }

            await logsClient.send(new PutSubscriptionFilterCommand({
                logGroupName: m.logGroup,
                filterName: 'logfox',
                destinationArn: lambdaArn,
                filterPattern: '',
            }));

            console.log(`✓ Created subscription filter for ${m.logGroup}`);

        } catch (error) {

            console.error(`✗ Failed to create subscription filter for ${m.logGroup}:`, error);

        }

    }

    console.log();
    console.log('Done! Logs will appear in Logfox within ~30 seconds.');
    console.log();
    console.log('To add more log groups later, run: logfox setup cloudwatch');
    console.log('To remove log groups, run: logfox cloudwatch remove');

}

function suggestAppName(logGroup: string): string {

    // Extract app name from common log group patterns
    // /aws/lambda/my-app-prod → my-app
    // /ecs/my-service → my-service

    const parts = logGroup.split('/').filter(Boolean);

    if (parts.length >= 3 && parts[0] === 'aws' && parts[1] === 'lambda') {

        // Remove common suffixes like -prod, -staging, -dev
        return parts[2].replace(/-(prod|production|staging|dev|development|test)$/i, '');

    }

    if (parts.length >= 2 && parts[0] === 'ecs') {

        return parts[1].replace(/-(prod|production|staging|dev|development|test)$/i, '');

    }

    // Default: use last part
    const last = parts[parts.length - 1] || 'app';
    return last.replace(/-(prod|production|staging|dev|development|test)$/i, '');

}

function suggestEnv(logGroup: string): string {

    const lower = logGroup.toLowerCase();

    if (lower.includes('prod')) return 'production';
    if (lower.includes('staging')) return 'staging';
    if (lower.includes('dev')) return 'development';
    if (lower.includes('test')) return 'test';

    return 'production';

}

function sleep(ms: number): Promise<void> {

    return new Promise((resolve) => setTimeout(resolve, ms));

}
