
.PHONY: build lint test deploy destroy

appName ?= default-WebhookDestinationStack

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
	npx cdk deploy $(appName) --require-approval never -c appName=$(appName)

destroy:
	npx cdk destroy $(appName) -c appName=$(appName)
