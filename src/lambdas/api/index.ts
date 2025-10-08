import { Logger } from '@aws-lambda-powertools/logger';
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { WebhookDataPayload } from '@smartcar/webhooks';
import { hashChallenge, parseEnvelope, verifySignature } from '@smartcar/webhooks';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const sqsClient = new SQSClient();;

const logger = new Logger();

/**
 * AWS Lambda handler for API Gateway requests. This handler should only 
 * do minimal processing of the request, such as validating the webhook
 * and webhook payloads, and then enqueue the message to SQS for further
 * processing by another Lambda function.
 *
 * @param event - The API Gateway event containing HTTP request data.
 * @returns A promise that resolves to an API Gateway proxy result
 *          (status code, headers, and body).
 *
 * @example
 * // Example of a minimal Lambda proxy response
 * return {
 *   statusCode: 200,
 *   body: JSON.stringify({ message: "All good" }),
 * };
 */
export const receiver = async (
    event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    if (!event || !event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'no body found',
            }),
        };
    }
    logger.info('Received webhook', { headers: event.headers, body: JSON.parse(event.body) });
    const eventPayload: WebhookDataPayload = parseEnvelope(event.body)

    //If it's a challenge call, meet the challenge by returning the hmac of the challenge
    if (eventPayload.eventType === 'VERIFY') {
        try {

            const applicationManagementToken: string | undefined = await getSecret(process.env.APP_TOKEN_SECRET_NAME!);
            const challenge = eventPayload.data.challenge;

            const hmac = hashChallenge(
                applicationManagementToken || '',
                challenge || '',
            );
            logger.info('Responding to challenge with hmac', { hmac });
            return {
                statusCode: 200,
                body: JSON.stringify({
                    challenge: `${hmac}`,
                }),
            };
        } catch (err) {
            logger.error('Error computing hmac for challenge', { error: err });
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Unable to compute hmac for the challenge',
                    error: `${err}`,
                }),
            };
        }
    }

    try {
        const applicationManagementToken: string | undefined = await getSecret(process.env.APP_TOKEN_SECRET_NAME!);

        // Verify the webhook payload was sent for this application from Smartcar
        const isValid = verifySignature(
            applicationManagementToken || '',
            JSON.stringify(eventPayload),
            event.headers["SC-Signature"] || '',
        );
        if (!isValid) {
            logger.error('Invalid webhook signature', { headers: event.headers });
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid webhook signature',
                }),
            };
        }
    } catch (err) {
        logger.error('Error validating webhook signature', { error: err });
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Unable to validate webhook signature',
                error: `${err}`,
            }),
        };
    }

    logger.info('Valid webhook payload received');

    // Send the message to SQS for application processing
    try {
        const params = {
            QueueUrl: process.env.QUEUE_URL!,
            MessageBody: event.body
        }
        const command = new SendMessageCommand(params);
        const response = await sqsClient.send(command);
        logger.info('Message sent to SQS', { response });
    } catch (err) {
        logger.error('Error sending message to SQS', { error: err });
    }

    // Always return 200 to Smartcar to avoid retries
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Webhook received successfully',
        }),
    };
};

