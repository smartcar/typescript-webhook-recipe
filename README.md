# Typescript Smartcar Webhook Receiver


## Design
This application is designed to receive Smartcar webhook events and process them asynchronously. 
![Design Diagram](docs/Design.png)
The API Gateway receives incoming webhook events and forwards them the [Receiver](src/lambdas/api/index.ts) lambda.

The **Reciever** lambda..
1. Validates the webhook URI by responding to the [initial verification challenge](https://smartcar.com/docs/integrations/webhooks/callback-verification)
2. Validates the webhook event payload using the [Smartcar signature header](https://smartcar.com/docs/integrations/webhooks/payload-verification)
3. Forwards valid webhook events to an SQS queue
4. Returns a 200 OK response to Smartcar

The [Processor](src/lambdas/sqs/index.ts) Lambda function handles messages in the SQS queue.
This function can be customized to perform any processing required for **your** application.

## Requirements
### AWS
* An AWS account - [sign up](https://signin.aws.amazon.com/signup?request_type=register)
* AWS CLI v2 configured with SSO - [instructions](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
* AWS CDK v2 - [instructions](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html)
* CDK Bootstrap activities - [bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html)
### Node/TypeScript
* Node.js 18+ 
* npm
* TypeScript

We recommend using [fnm](https://github.com/Schniz/fnm?tab=readme-ov-file#installation) to manage your Node versions.

### Other
* GNU Make

#### Debian/Ubuntu
```
sudo apt update
sudo apt install -y build-essential
```

#### MacOS
```
xcode-select --install
```




## Usage
1. Login to AWS SSO
    ```
    aws sso login
    ```

    > **__NOTE:__** [Makefile](/Makefile) commands use the configured default AWS profile. Ensure that your environment variables or ~/.aws/config file are set to your target AWS Account. See [AWS CLI docs](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html) for more info.


1. Create Application Management Token SECRET. Get the value used in the following command from the [Smartcar Dashboard](https://dashboard.smartcar.com/)-> Configuration-> API Keys
    ```
    make create-secret appName=<your-app-name> amt=<your-application-management-token>
    ```

1. Deploy
    ```
    make deploy appName=<your-app-name>
    ```

    > **__NOTE:__** Use the same `<your-app-name>` as used when creating the secret
1. Copy the **ApiEndpointUrl** output from the successful command above and paste it in the [Smartcar Webhook Callback URI](https://dashboard.smartcar.com/)
1. Subscribe vehicles to your webhook in the Smartcar Dashboard and see incoming events logged to CloudWatch log groups.

For more information on webhook setup, see [Smartcar's documentation](https://smartcar.com/docs/integrations/webhooks/overview).

## Removal
```
make destroy appName=<your-app-name>
```
