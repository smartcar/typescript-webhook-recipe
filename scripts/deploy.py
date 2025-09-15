#!/usr/bin/env python3
import argparse
import getpass
import sys

def main():
	parser = argparse.ArgumentParser(description="Deploy application with AWS profile and client secret.")
	parser.add_argument('-i', '--interactive', action='store_true', help='Run in interactive mode (default if no args)')
	parser.add_argument('--profile', type=str, default=None, help='AWS profile name (default: default)')
	parser.add_argument('--application-name', type=str, default=None, help='Application name (required if not interactive)')
	parser.add_argument('--client-secret', type=str, default=None, help='Client secret (required if not interactive)')
	args = parser.parse_args()

	interactive = args.interactive or (len(sys.argv) == 1)

	if interactive:
		aws_profile = input("Enter AWS profile name (leave blank for 'default'): ").strip() or 'default'
		application_name = input("Enter application name: ").strip()
		while not application_name:
			print("Application name is required.")
			application_name = input("Enter application name: ").strip()
		client_secret = input("Enter client secret: ").strip()
		while not client_secret:
			print("Client secret is required.")
			client_secret = input("Enter client secret: ").strip()
	else:
		aws_profile = args.aws_profile or 'default'
		application_name = args.application_name
		client_secret = args.client_secret
		if not application_name or not client_secret:
			print("Error: --application-name and --client-secret are required in non-interactive mode.")
			sys.exit(1)

	print(f"Using AWS profile: {aws_profile}")
	print(f"Application name: {application_name}")
    print(f"Client secret: {'*' * (len(client_secret)-4)}{client_secret[-4:]}")
	# Add your deployment logic here

if __name__ == "__main__":
	main()
