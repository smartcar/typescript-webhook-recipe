
.PHONY: build lint test create-secret deploy destroy

appName :=
amt :=

# Check only appName
check-appName:
	@if [ -z "$(appName)" ]; then \
		echo "❌ ERROR: You must specify appName. Example:"; \
		echo "   make deploy appName=MyStack"; \
		exit 1; \
	fi

# Check both appName and amt
check-all:
	@if [ -z "$(appName)" ] || [ -z "$(amt)" ]; then \
		echo "❌ ERROR: You must specify both appName and amt. Example:"; \
		echo "   make create-secret appName=MyStack amt=mysecret"; \
		exit 1; \
	fi

build:
	npm ci
	npm run build
test:
	echo "TODO: Implement unit tests"
lint:
	npm run lint

create-secret: check-all
	aws secretsmanager create-secret \
		--name $(appName)-secret \
		--description "AMT Webhook Receiver Secret" \
		--secret-string $(amt)

deploy: check-appName build
	npx cdk deploy $(appName) --require-approval never -c appName=$(appName)

destroy: check-appName
	npx cdk destroy $(appName) -c appName=$(appName)
	aws secretsmanager delete-secret \
		--secret-id $(appName)-secret \
		--force-delete-without-recovery
