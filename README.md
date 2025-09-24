# Typescript Smartcar Webhook solution template
Walk through the interactive deployment after configuring your target AWS account target.
Deployed infrastructure includes...
 * API Gateway 
 * 2 Lambdas
 * SQS Queue

# Design
TODO

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


## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
