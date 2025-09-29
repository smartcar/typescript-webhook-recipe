# Typescript Smartcar Webhook solution template
Walk through the interactive deployment after configuring your target AWS account target.
Deployed infrastructure includes...
 * API Gateway 
 * 2 Lambdas
 * SQS Queue

# Design
This application is designed to receive Smartcar webhook events and process them asynchronously. 

The API Gateway receives incoming webhook events and forwards them to the first Lambda function (receiver.ts) that:
1. Validates the webhook signature challenge
2. Validates the webhook event signature
3. Forwards valid webhook events to an SQS queue
4. Returns a 200 OK response to Smartcar

The second Lambda function (processor.ts) is triggered by messages in the SQS queue and processes the webhook events.
This function can be customized to perform any processing required for your application.

# Requirements
### AWS
* An AWS account - [sign up](https://signin.aws.amazon.com/signup?request_type=register)
* AWS CLI v2 configured with SSO - [instructions](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
* AWS CDK v2 - [instructions](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html)

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


# Deployments

## Interactive deploy

TODO: python script in ./scripts/deploy

## Deploy using Make
1. Login
```
aws sso login
```

2. Build
```
make build
```

2. Test
```
make test
```

2. Deploy
```
make deploy appName=<your-app-name> amt=<your-application-management-token>
```

## Destroy using Make
```
make destroy appName=<your-app-name>
```

# Integrating with Smartcar
1. In AWS console, navigate to Lambda -> Applications -> YourAppName
2. On the Overview page, copy the URL for the API Endpoint
3. In the [Smartcar Developer portal](https://dashboard.smartcar.com/), use this URL as the Vehicle data callback URI for your integration
4. Navigate to CloudWatch -> Log groups and find the log group for the `/aws/lambda/YourAppName` lambda to view incoming webhook events

For more info on setting up a Smartcar integration see [Smartcar's documentation](https://smartcar.com/docs/integrations/webhooks/overview).


## Local Development
1. Install dependencies
```
npm install
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
