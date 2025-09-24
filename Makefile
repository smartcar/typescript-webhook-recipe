
.PHONY: build lint test deploy destroy

appName ?= default-WebhookDestinationStack
amt ?= changeme

build:
	npm install
	npm run build
test:
	echo "TODO: Implement unit tests"
lint:
	npm run lint

deploy:
	npm install
	npm run build
	npx cdk deploy $(appName) --require-approval never -c appName=$(appName) -c amt=$(amt)

destroy:
	npx cdk destroy $(appName) -c appName=$(appName)
