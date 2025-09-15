#!/usr/bin/env bash
# Interactive script to set AWS profile and create a secret in AWS Secrets Manager

# Prompt for AWS profile
read -p "Enter AWS profile name (leave blank for 'default'): " AWS_PROFILE_NAME
if [[ -z "$AWS_PROFILE_NAME" ]]; then
  AWS_PROFILE_NAME="default"
fi
export AWS_PROFILE="$AWS_PROFILE_NAME"
echo "Using AWS profile: $AWS_PROFILE"

# Prompt for client secret
read -p "Enter client secret: " CLIENT_SECRET
echo

# Prompt for secret name
read -p "Enter a name for the AWS Secret: " SECRET_NAME

# Create the secret in AWS Secrets Manager
aws secretsmanager create-secret --name "$SECRET_NAME" --secret-string "$CLIENT_SECRET" --profile "$AWS_PROFILE"

if [[ $? -eq 0 ]]; then
  echo "Secret '$SECRET_NAME' created successfully."
else
  echo "Failed to create secret."
fi
