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
    
    // Verify the webhook payload
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

    console.log('Valid webhook received');

  
    console.warn('WEBHOOK EVENT::', event.body);
    const params = {
        QueueUrl: process.env.QUEUE_URL!,
        MessageBody: event.body,
    }
    try {
        const command = new SendMessageCommand(params);
        const response = await sqsClient.send(command);
        logger.info('SQS send message response', { response });
    } catch (err) {
        logger.error('Error sending message to SQS', { err });
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Error signal detected, but no action taken',
        }),
    };
};
