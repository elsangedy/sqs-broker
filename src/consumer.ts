import {
  Message,
  SQSClient,
  DeleteMessageCommand,
  ReceiveMessageCommand,
} from '@aws-sdk/client-sqs';
import mitt from 'mitt';

export type SQSBrokerConsumerEvents = {
  empty: void;
  stopped: void;
  response_processed: void;
  message_received: Message;
  message_processed: Message;
  error: Error | [Error, Message];
  processing_error: [Error, Message];
};

export type SQSBrokerConsumerOptions = {
  onMessage(message: Message): Promise<void>;
  queueUrl: string;
  region?: string;
  sqsClient?: SQSClient;
  attributeNames?: string[];
  waitTimeSeconds?: number;
  visibilityTimeout?: number;
  maxNumberOfMessages?: number;
  messageAttributeNames?: string[];
  pollingWaitTimeMs?: number;
};

export const createSQSBrokerConsumer = (options: SQSBrokerConsumerOptions) => {
  const {
    onMessage,
    queueUrl,
    region = process.env.AWS_REGION || 'eu-west-1',
    sqsClient = new SQSClient({ region }),
    attributeNames = [],
    waitTimeSeconds = 20,
    visibilityTimeout,
    maxNumberOfMessages = 1,
    messageAttributeNames = [],
    pollingWaitTimeMs = 0,
  } = options;

  let isRunning = false;

  const emitter = mitt<SQSBrokerConsumerEvents>();

  const poll = (): void => {
    if (!isRunning) {
      emitter.emit('stopped');
      return;
    }

    sqsClient
      .send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          AttributeNames: attributeNames,
          WaitTimeSeconds: waitTimeSeconds,
          VisibilityTimeout: visibilityTimeout,
          MaxNumberOfMessages: maxNumberOfMessages,
          MessageAttributeNames: messageAttributeNames,
        })
      )
      .then(async output => {
        if (output?.Messages?.length) {
          await Promise.all(
            output.Messages.map(
              async (message: Message): Promise<void> => {
                emitter.emit('message_received', message);
                try {
                  await onMessage(message);
                  await sqsClient.send(
                    new DeleteMessageCommand({
                      QueueUrl: queueUrl,
                      ReceiptHandle: message.ReceiptHandle,
                    })
                  );
                  emitter.emit('message_processed', message);
                } catch (err) {
                  emitter.emit('processing_error', [err, message]);
                }
              }
            )
          );
          emitter.emit('response_processed');
        } else {
          emitter.emit('empty');
        }
      })
      .then(() => {
        setTimeout(poll, pollingWaitTimeMs);
      })
      .catch(err => {
        emitter.emit('error', err);
      });
  };

  return {
    stop: () => {
      isRunning = false;
    },
    start: () => {
      if (!isRunning) {
        isRunning = true;
        poll();
      }
    },
    on: emitter.on,
    off: emitter.off,
  };
};
