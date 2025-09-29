import { Logger } from '@aws-lambda-powertools/logger';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient();;

import * as smartcar from 'smartcar';

const logger = new Logger();

type PostRequestType = {
    version: string
    webhookId: string,
    eventName: string
    eventType: string,
    data: { challenge: string }
}

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
export const handler = async (
    event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    const applicationManagementToken = process.env.APPLICATION_MANAGEMENT_TOKEN;
    if (!event || !event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'no body found',
            }),
        };
    }
    console.log('Received HEADERS', event.headers);
    console.log('Received PATH PARAMS:', event.pathParameters);
    console.log('Received BODY->', event.body);
    const postRequest: PostRequestType = JSON.parse(event.body)

    //If it's a challenge call, meet the challenge by returning the hmac of the challenge
    if (postRequest.eventType === 'VERIFY') {
        try {

            const hmac = smartcar.hashChallenge(
                applicationManagementToken,
                postRequest.data.challenge
            );
            return {
                statusCode: 200,
                body: JSON.stringify({
                    challenge: `${hmac}`,
                }),
            };
        } catch (err) {
            console.log(err);
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
    
    // Verify the webhook payload was sent for this application from Smartcar
    const isValid = smartcar.verifyPayload(
        applicationManagementToken,
        event.headers["SC-Signature"] || '',
        postRequest
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

    logger.info('Valid webhook payload received');

  
    // Send the message to SQS for application processing
    try {
        const params = {
            QueueUrl: process.env.QUEUE_URL!,
            MessageBody: event.body,
        }
        const command = new SendMessageCommand(params);
        const response = await sqsClient.send(command);
        console.log('SQS send message response', { response });
    } catch (err) {
        console.log('Error sending message to SQS', { err });
    }
    
    // Always return 200 to Smartcar to avoid retries
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Webhook received successfully',
        }),
    };
};


