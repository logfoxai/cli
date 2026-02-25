import {LambdaClient, UpdateFunctionCodeCommand, GetFunctionCommand} from '@aws-sdk/client-lambda';
import {STSClient, GetCallerIdentityCommand} from '@aws-sdk/client-sts';

const FORWARDER_LAMBDA_NAME = 'LogfoxForwarder';
const FORWARDER_S3_BUCKET = 'logfox-public-assets';
const FORWARDER_S3_KEY = 'forwarder/v1/forwarder.zip';

export async function updateCloudwatch(): Promise<void> {

    console.log('Logfox CloudWatch Update');
    console.log('========================');
    console.log();

    // 1. Check AWS credentials
    console.log('Checking AWS credentials...');

    const sts = new STSClient({});

    try {

        const identity = await sts.send(new GetCallerIdentityCommand({}));
        const region = await sts.config.region() as string;
        console.log(`✓ Using AWS account ${identity.Account} (${region})`);

    } catch {

        console.error('✗ Failed to get AWS credentials.');
        console.error('  Make sure you have AWS credentials configured.');
        console.error('  Run: aws configure');
        process.exit(1);

    }

    console.log();

    // 2. Check if Lambda exists
    console.log('Checking for existing Logfox Forwarder Lambda...');

    const lambdaClient = new LambdaClient({});

    try {

        await lambdaClient.send(new GetFunctionCommand({
            FunctionName: FORWARDER_LAMBDA_NAME,
        }));

        console.log(`✓ Found Lambda: ${FORWARDER_LAMBDA_NAME}`);

    } catch {

        console.error(`✗ Lambda "${FORWARDER_LAMBDA_NAME}" not found.`);
        console.error('  Run "logfox setup cloudwatch" first to deploy the Lambda.');
        process.exit(1);

    }

    console.log();

    // 3. Update Lambda code
    console.log('Updating Lambda code from S3...');

    try {

        await lambdaClient.send(new UpdateFunctionCodeCommand({
            FunctionName: FORWARDER_LAMBDA_NAME,
            S3Bucket: FORWARDER_S3_BUCKET,
            S3Key: FORWARDER_S3_KEY,
        }));

        console.log(`✓ Updated ${FORWARDER_LAMBDA_NAME} to latest version`);

    } catch (error) {

        console.error('✗ Failed to update Lambda:', error);
        process.exit(1);

    }

    console.log();
    console.log('Done! The Logfox Forwarder Lambda has been updated.');

}
