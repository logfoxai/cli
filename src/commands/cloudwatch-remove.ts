import {STSClient, GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    DescribeSubscriptionFiltersCommand,
    DeleteSubscriptionFilterCommand,
    SubscriptionFilter,
} from '@aws-sdk/client-cloudwatch-logs';
import {LambdaClient, GetFunctionCommand} from '@aws-sdk/client-lambda';
import {checkbox, confirm} from '@inquirer/prompts';

const FORWARDER_LAMBDA_NAME = 'LogfoxForwarder';

interface LogfoxFilter {
    logGroupName: string;
    filterName: string;
}

export async function cloudwatchRemove(): Promise<void> {

    console.log('Logfox CloudWatch Remove');
    console.log('========================');
    console.log();

    // 1. Check AWS credentials
    console.log('Checking AWS credentials...');

    const sts = new STSClient({});
    let region: string;

    try {

        const identity = await sts.send(new GetCallerIdentityCommand({}));
        region = await sts.config.region() as string;
        console.log(`✓ Using AWS account ${identity.Account} (${region})`);

    } catch {

        console.error('✗ Failed to get AWS credentials.');
        console.error('  Make sure you have AWS credentials configured.');
        console.error('  Run: aws configure');
        process.exit(1);

    }

    console.log();

    // 2. Get Lambda ARN
    console.log('Looking for Logfox Forwarder Lambda...');

    const lambdaClient = new LambdaClient({});
    let lambdaArn: string | undefined;

    try {

        const lambda = await lambdaClient.send(new GetFunctionCommand({
            FunctionName: FORWARDER_LAMBDA_NAME,
        }));

        lambdaArn = lambda.Configuration?.FunctionArn;
        console.log(`✓ Found Lambda: ${FORWARDER_LAMBDA_NAME}`);

    } catch {

        console.log('⚠ Lambda not found. Will search for subscription filters by name.');

    }

    console.log();

    // 3. Find all subscription filters pointing to Logfox
    console.log('Scanning for Logfox subscription filters...');

    const logsClient = new CloudWatchLogsClient({});
    const logfoxFilters: LogfoxFilter[] = [];

    // Get all log groups
    let nextToken: string | undefined;

    do {

        const logGroupsResponse = await logsClient.send(new DescribeLogGroupsCommand({nextToken}));

        for (const logGroup of logGroupsResponse.logGroups || []) {

            if (!logGroup.logGroupName) continue;

            try {

                const filtersResponse = await logsClient.send(new DescribeSubscriptionFiltersCommand({
                    logGroupName: logGroup.logGroupName,
                }));

                for (const filter of filtersResponse.subscriptionFilters || []) {

                    if (isLogfoxFilter(filter, lambdaArn)) {

                        logfoxFilters.push({
                            logGroupName: logGroup.logGroupName,
                            filterName: filter.filterName!,
                        });

                    }

                }

            } catch {
                // Ignore errors for individual log groups
            }

        }

        nextToken = logGroupsResponse.nextToken;

    } while (nextToken);

    if (logfoxFilters.length === 0) {

        console.log('No Logfox subscription filters found.');
        console.log('Nothing to remove.');
        process.exit(0);

    }

    console.log(`Found ${logfoxFilters.length} Logfox subscription filter(s)`);
    console.log();

    // 4. Let user select which to remove
    const toRemove = await checkbox({
        message: 'Select subscription filters to remove:',
        choices: logfoxFilters.map((f) => ({
            name: f.logGroupName,
            value: f,
            checked: true,
        })),
        pageSize: 15,
    });

    if (toRemove.length === 0) {

        console.log('No filters selected. Exiting.');
        process.exit(0);

    }

    console.log();

    // 5. Confirm
    const proceed = await confirm({
        message: `Remove ${toRemove.length} subscription filter(s)?`,
        default: true,
    });

    if (!proceed) {

        console.log('Cancelled.');
        process.exit(0);

    }

    console.log();

    // 6. Delete selected filters
    console.log('Removing subscription filters...');

    for (const filter of toRemove) {

        try {

            await logsClient.send(new DeleteSubscriptionFilterCommand({
                logGroupName: filter.logGroupName,
                filterName: filter.filterName,
            }));

            console.log(`✓ Removed subscription filter for ${filter.logGroupName}`);

        } catch (error) {

            console.error(`✗ Failed to remove filter for ${filter.logGroupName}:`, error);

        }

    }

    console.log();
    console.log('Done! The selected log groups will no longer send logs to Logfox.');
    console.log();
    console.log('Note: The Logfox Forwarder Lambda is still deployed.');
    console.log('To completely remove it, delete the Lambda manually in the AWS Console.');

}

function isLogfoxFilter(filter: SubscriptionFilter, lambdaArn?: string): boolean {

    // Check if filter name is 'logfox'
    if (filter.filterName === 'logfox') {

        return true;

    }

    // Check if destination is the Logfox Lambda
    if (lambdaArn && filter.destinationArn === lambdaArn) {

        return true;

    }

    // Check if destination contains 'LogfoxForwarder'
    if (filter.destinationArn?.includes('LogfoxForwarder')) {

        return true;

    }

    return false;

}
