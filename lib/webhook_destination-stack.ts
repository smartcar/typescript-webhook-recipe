import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { join } from 'path';

// ES module imports
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export class WebhookDestinationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a dead letter queue with a 14-day retention period
    const deadLetterQueue = new sqs.Queue(this, 'ProcessorDeadLetterQueue', {
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create the SQS destination queue for the webhook receiver lambda
    // This queue will retry failed messages 3 times before sending them to the DLQ
    const queue = new sqs.Queue(this, 'ProcessorQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue,
      },
    });

    // Lambda that handles messages from ProcessorQueue.
    // This lambda can be scaled up with more memory and time if needed.
    const processorLambdaFunction = new lambdaNodejs.NodejsFunction(this, 'Processor', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      environment: {
        POWERTOOLS_SERVICE_NAME: `${id}-Processor`,
        POWERTOOLS_LOG_LEVEL: "INFO",
      },
      entry: join(__dirname, '..', 'src/lambdas/sqs', 'index.ts'),
      handler: 'processor',
    });

    // Attach SQS as an event source to the processor Lambda
    processorLambdaFunction.addEventSource(
      new lambdaSources.SqsEventSource(queue, {
        batchSize: 10, // process up to 10 messages at once
        reportBatchItemFailures: true, // enable partial batch failure handling
      })
    );

    // Lambda that receives webhook calls from Smartcar application.
    // This lambda should should complete processing within 10 seconds.
    // It will use the APP_TOKEN_SECRET_NAME secret to answer challenges and verify signatures.
    // It will enqueue valid webhook messages to SQS for further processing.
    const receiverLambdaFunction = new lambdaNodejs.NodejsFunction(this, 'Receiver-', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      environment: {
        POWERTOOLS_SERVICE_NAME: id,
        POWERTOOLS_LOG_LEVEL: "INFO",
        APP_TOKEN_SECRET_NAME: `${id}-secret`,
        QUEUE_URL: queue.queueUrl,
      },
      entry: join(__dirname, '..', 'src/lambdas/api', 'index.ts'),
      handler: 'receiver',
    });

    queue.grantSendMessages(receiverLambdaFunction);



    // AMT secret
    const appTokenSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      id,
      `${id}-secret`
    );

    appTokenSecret.grantRead(receiverLambdaFunction);

    // Create a REST API with a catch-all ANY method on any resource
    const api = new apigateway.RestApi(this, 'WebhookEndpoint', {
      deployOptions: {
        stageName: 'prod',
      },
    });

    const proxyResource = api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', new apigateway.LambdaIntegration(receiverLambdaFunction));
    api.root.addMethod('ANY', new apigateway.LambdaIntegration(receiverLambdaFunction));

    new cdk.CfnOutput(this, 'ApiEndpointUrl', {
      value: api.url,
      description: 'The endpoint URL of the API Gateway',
    });
  }
}

