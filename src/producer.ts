import {
  SendMessageBatchRequestEntry,
  SendMessageBatchResultEntry,
  SQSClient,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';

export interface SQSBrokerProducerMessage<T = any> {
  id: string;
  body: T;
  delaySeconds?: number;
  groupId?: string;
  deduplicationId?: string;
  attributes?: SendMessageBatchRequestEntry['MessageAttributes'];
  systemAttributes?: SendMessageBatchRequestEntry['MessageSystemAttributes'];
}

export interface SQSBrokerProducerOptions {
  queueUrl: string;
  region?: string;
  sqsClient?: SQSClient;
  batchSize?: number;
}

export class SQSBrokerProducer {
  private queueUrl: string;
  private sqsClient: SQSClient;
  private batchSize: number;

  constructor(options: SQSBrokerProducerOptions) {
    const {
      queueUrl,
      region = process.env.AWS_REGION || 'eu-west-1',
      sqsClient = new SQSClient({ region }),
      batchSize = 10,
    } = options;

    this.queueUrl = queueUrl;
    this.sqsClient = sqsClient;
    this.batchSize = batchSize;
  }

  public async send(
    messages:
      | string
      | SQSBrokerProducerMessage
      | (string | SQSBrokerProducerMessage)[]
  ): Promise<SendMessageBatchResultEntry[]> {
    const messagesArr = !Array.isArray(messages) ? [messages] : messages;

    return this.sendBatch(
      messagesArr.map(message =>
        typeof message === 'string'
          ? {
              id: message,
              body: message,
            }
          : message
      )
    );
  }

  private async sendBatch(
    messages: SQSBrokerProducerMessage[] = [],
    startIndex: number = 0,
    failedMessages: string[] = [],
    successfulMessages: SendMessageBatchResultEntry[] = []
  ): Promise<SendMessageBatchResultEntry[]> {
    const endIndex = startIndex + this.batchSize;
    const batch = messages.slice(startIndex, endIndex);

    const result = await this.sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: batch.map(entry => ({
          Id: entry.id,
          MessageBody: entry.body,
          DelaySeconds: entry.delaySeconds,
          MessageGroupId: entry.groupId,
          MessageDeduplicationId: entry.deduplicationId,
          MessageAttributes: entry.attributes,
          MessageSystemAttributes: entry.systemAttributes,
        })),
      })
    );

    const failedMessagesBatch = failedMessages.concat(
      result.Failed?.map(entry => entry.Id!) || []
    );

    const successfulMessagesBatch = successfulMessages.concat(
      result.Successful || []
    );

    if (endIndex < messages.length) {
      return this.sendBatch(
        messages,
        endIndex,
        failedMessagesBatch,
        successfulMessagesBatch
      );
    }

    if (failedMessagesBatch.length === 0) {
      return successfulMessagesBatch;
    }

    throw new Error(
      `failed to send messages: ${failedMessagesBatch.join(', ')}`
    );
  }
}
