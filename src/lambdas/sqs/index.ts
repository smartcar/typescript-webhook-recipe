import { Logger } from '@aws-lambda-powertools/logger';
import { getSignalByCode, Signals, type TractionBatteryStateOfCharge } from "@smartcar/signals";
import type { WebhookDataPayload } from '@smartcar/webhooks';
import { parseEnvelope } from '@smartcar/webhooks';
import { Context, SQSEvent, SQSHandler } from 'aws-lambda';

const logger = new Logger();
/**
 * AWS Lambda handler for processing messages from an SQS queue. Do any 
 * application-specific processing of the messages here (i.e. API calls, file IO, etc).
 *
 * @param event - The SQS event containing one or more messages from the queue.
 * @param context - The AWS Lambda context object providing runtime information.
 * @returns Batch item failures used to retry failed messages.
 *
 */
export const processor: SQSHandler = async (
  event: SQSEvent,
  context: Context
) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      logger.debug('Processing message', { messageId: record.messageId, body: JSON.parse(record.body), awsRequestId: context.awsRequestId });

      const eventBody: WebhookDataPayload = parseEnvelope(record.body);
      const signals: Signals = eventBody.data.signals as Signals;
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
        logger.warn('Errors in webhook payload', { errors });
      }
    } catch (err) {
      logger.error('Error during processing', { error: err, record });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // For SQS partial batch response, return failed items
  return { batchItemFailures };
};
