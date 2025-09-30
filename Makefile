
.PHONY: build lint test create-secret deploy destroy

appName ?= default-WebhookDestinationStack
amt ?= changeme

build:
	npm install
	npm run build
test:
	echo "TODO: Implement unit tests"
lint:
	npm run lint

create-secret:
	aws secretsmanager create-secret --name $(appName)-secret --description "AMT Webhook Receiver Secret" --secret-string $(amt)

deploy:
	npm install
	npm run build
	npx cdk deploy $(appName) --require-approval never -c appName=$(appName) -c amt=$(amt)

destroy:
	npx cdk destroy $(appName) -c appName=$(appName)
	aws secretsmanager delete-secret --secret-id $(appName)-secret --force-delete-without-recovery
