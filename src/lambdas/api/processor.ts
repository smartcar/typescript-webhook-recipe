import { Logger } from '@aws-lambda-powertools/logger';
import { SQSEvent, Context, SQSHandler } from 'aws-lambda';
import { getSignalByCode, type TractionBatteryStateOfCharge, Signals } from "@smartcar/signals";
import { parseEnvelope } from '@smartcar/webhooks';
import type { WebhookDataPayload } from '@smartcar/webhooks';

const logger = new Logger();
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
    
    logger.info('Processing message', { messageId: message.messageId, body: JSON.parse(message.body), awsRequestId: context.awsRequestId });
    
    try {
      const eventBody: WebhookDataPayload = parseEnvelope(message.body);
      const signals: Signals  = eventBody.data.signals as Signals;
      const { errors } = eventBody.data;
      
      if (signals && signals.length > 0) {
        const stateOfChargeSignal: TractionBatteryStateOfCharge | undefined = getSignalByCode<TractionBatteryStateOfCharge>(signals, 'tractionbattery-stateofcharge');
        if (stateOfChargeSignal) {
          logger.info('State of Charge Signal', stateOfChargeSignal.body);
          if (stateOfChargeSignal.body.value < 50) {
            logger.info('Battery below 50% - get charged!');
          }
        }
      }
      if (errors && errors.length > 0) {
        logger.warn('Errors in webhook payload', { errors } );
      }
    } catch (err) {
      logger.error('Error retrieving state of charge signal', { error: err } );
    }
  }
};
