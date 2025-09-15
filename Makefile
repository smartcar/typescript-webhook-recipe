
.PHONY: build lint test deploy

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
	npx cdk deploy czh-WebhookDestinationStack --require-approval never
