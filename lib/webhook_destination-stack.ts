import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { join } from 'path';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WebhookDestinationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Create a new SQS queue
    const queue = new sqs.Queue(this, 'WebhookQueue', {
      queueName: `${id}-handler-queue`,
      visibilityTimeout: cdk.Duration.seconds(30),
    });
    
    const webhookFunction = new lambdaNodejs.NodejsFunction(this, 'WebhookHandler', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      environment: {
        POWERTOOLS_SERVICE_NAME: id,
        POWERTOOLS_LOG_LEVEL: "INFO",
        APPLICATION_MANAGEMENT_TOKEN: scope.node.tryGetContext('amt'),
        QUEUE_URL: queue.queueUrl,
      },
      entry: join(__dirname, '..', 'src/lambdas/api', 'index.ts'),
      handler: 'index.handler',
    });

    queue.grantSendMessages(webhookFunction);


    // NEW: Lambda that processes messages from SQS
    const processorFunction = new lambdaNodejs.NodejsFunction(this, 'QueueProcessor', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      environment: {
        POWERTOOLS_SERVICE_NAME: `${id}-processor`,
        POWERTOOLS_LOG_LEVEL: "INFO",
      },
      entry: join(__dirname, '..', 'src/lambdas/api', 'index.ts'),
      handler: 'index.processor',
    });

    // Attach SQS as an event source to the processor Lambda
    processorFunction.addEventSource(
      new lambdaSources.SqsEventSource(queue, {
        batchSize: 10, // process up to 10 messages at once
      })
    );
    

    // Create a REST API with a catch-all ANY method on any resource
    const api = new apigateway.RestApi(this, 'WebhookEndpoint', {
      deployOptions: {
        stageName: 'prod',
      },
    });

    const proxyResource = api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', new apigateway.LambdaIntegration(webhookFunction));
    api.root.addMethod('ANY', new apigateway.LambdaIntegration(webhookFunction));

    new cdk.CfnOutput(this, 'ApiEndpointUrl', {
      value: api.url,
      description: 'The endpoint URL of the API Gateway',
    });
  }
}
