import { Logger } from '@aws-lambda-powertools/logger';
import { SQSEvent, Context, SQSHandler, SQSRecord } from 'aws-lambda';
import { getSignalByCode, type TractionBatteryStateOfCharge, type Signals } from "@smartcar/signals";

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
