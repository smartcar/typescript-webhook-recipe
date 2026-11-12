import { Logger } from '@aws-lambda-powertools/logger';
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { WebhookDataPayload } from '@smartcar/webhooks';
import { hashChallenge, parseEnvelope } from '@smartcar/webhooks';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHmac, timingSafeEqual } from 'node:crypto';

const sqsClient = new SQSClient();;

const logger = new Logger();

/**
 * Check SC-Signature against HMAC-SHA256(AMT, rawBody), using a constant-time
 * comparison. rawBody must be the request body exactly as received.
 */
export const isValidSignature = (
    applicationManagementToken: string,
    rawBody: string,
    signature: string | undefined,
): boolean => {
    if (!signature) {
        return false;
    }
    const expected = createHmac('sha256', applicationManagementToken)
        .update(rawBody)
        .digest();
    const received = Buffer.from(signature, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
};

const getHeader = (
    headers: APIGatewayProxyEvent['headers'],
    name: string,
): string | undefined => {
    const key = Object.keys(headers || {}).find((h) => h.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
};

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

            if (!applicationManagementToken) {
                throw new Error('Application Management Token is not configured');
            }

            // Confirm the VERIFY request came from Smartcar before hashing the
            // challenge. The challenge response is HMAC-SHA256(AMT, challenge), the
            // same construction as SC-Signature on events, so hashing a challenge
            // from an unsigned request would let an attacker obtain a valid
            // signature for a forged event body. VERIFY is signed with SC-Signature
            // just like events, so verify it the same way.
            if (!isValidSignature(applicationManagementToken, event.body, getHeader(event.headers, 'SC-Signature'))) {
                logger.warn('Rejecting VERIFY with invalid SC-Signature');
                return {
                    statusCode: 401,
                    body: JSON.stringify({
                        message: 'invalid signature',
                    }),
                };
            }

            const challenge = eventPayload.data?.challenge;
            if (typeof challenge !== 'string' || !challenge) {
                logger.warn('Rejecting VERIFY with a missing challenge');
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        message: 'missing challenge',
                    }),
                };
            }

            const hmac = hashChallenge(
                applicationManagementToken,
                challenge,
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

        if (!applicationManagementToken) {
            throw new Error('Application Management Token is not configured');
        }

        // Verify the webhook payload was sent for this application from Smartcar.
        // Always verify against the raw request body exactly as received, never
        // a re-serialized copy of the parsed JSON.
        const isValid = isValidSignature(
            applicationManagementToken,
            event.body,
            getHeader(event.headers, 'SC-Signature'),
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

