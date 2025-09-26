import { Logger } from '@aws-lambda-powertools/logger';
import { APIGatewayProxyEvent, APIGatewayProxyResult, SQSEvent, Context, SQSHandler, SQSRecord } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getSignalByCode, type TractionBatteryStateOfCharge, type Signals } from "@smartcar/signals";

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


/**
 * AWS Lambda handler for processing messages from an SQS queue. Do any 
 * application-specific processing of the messages here (i.e. API calls, file IO, etc).
 *
 * @param event - The SQS event containing one or more messages from the queue.
 * @param context - The AWS Lambda context object providing runtime information.
 * @returns A promise that resolves when all messages have been processed.
 *
 * @example
 * // Example of iterating through messages
 * for (const record of event.Records) {
 *   console.log("Message body:", record.body);
 * }
 */
export const processor: SQSHandler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  for (const message of event.Records) {
    console.log('Processing message:', message.body);
    try {
      const eventBody = JSON.parse(message.body)
      const { signals } = eventBody.data;
      const stateOfChargeSignal: TractionBatteryStateOfCharge | undefined = getSignalByCode<TractionBatteryStateOfCharge>(signals, 'tractionbattery-stateofcharge');
      if (stateOfChargeSignal) {
        console.log('State of Charge Signal', stateOfChargeSignal.body);
        if (stateOfChargeSignal.body.value < 50) {
          console.log('Battery below 50% - take action!');
        }
      }
    } catch (err) {
      logger.error(`Error retrieving state of charge signal: ${err}`);
    }
  }
};
