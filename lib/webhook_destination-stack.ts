import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WebhookDestinationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const webhookFunction = new lambdaNodejs.NodejsFunction(this, 'WebhookHandler', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      environment: {
        POWERTOOLS_SERVICE_NAME: id,
        POWERTOOLS_LOG_LEVEL: "INFO",
        APPLICATION_MANAGEMENT_TOKEN: "135bbef6-74f3-4535-9746-e4d077c2666c"
      },
      entry: join(__dirname, '..', 'src/lambdas/api', 'index.ts'),
      handler: 'index.handler',
    });

    // Create a new SQS queue
    const queue = new sqs.Queue(this, 'WebhookQueue', {
      queueName: `${id}-handler-queue`,
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    
    queue.grantSendMessages(webhookFunction);

    webhookFunction.addEnvironment('QUEUE_URL', queue.queueUrl);
    

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
