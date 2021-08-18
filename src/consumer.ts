import {
  Message,
  SQSClient,
  DeleteMessageCommand,
  ReceiveMessageCommand,
} from '@aws-sdk/client-sqs';
import mitt, { Emitter } from 'mitt';

export type SQSBrokerConsumerEvents = {
  empty: void;
  stopped: void;
  response_processed: void;
  message_received: Message;
  message_processed: Message;
  error: Error | [Error, Message];
  processing_error: [Error, Message];
};

type MessageHandler = (message: Message) => Promise<void>;

export interface SQSBrokerConsumerOptions {
  onMessage: MessageHandler;
  queueUrl: string;
  region?: string;
  sqsClient?: SQSClient;
  attributeNames?: string[];
  waitTimeSeconds?: number;
  visibilityTimeout?: number;
  maxNumberOfMessages?: number;
  messageAttributeNames?: string[];
  pollingWaitTimeMs?: number;
  running?: boolean;
}

export class SQSBrokerConsumer {
  private onMessage: MessageHandler;
  private queueUrl: string;
  private sqsClient: SQSClient;
  private attributeNames: string[];
  private waitTimeSeconds: number;
  private visibilityTimeout?: number;
  private maxNumberOfMessages: number;
  private messageAttributeNames: string[];
  private pollingWaitTimeMs: number;

  private running: boolean;

  private emitter: Emitter<SQSBrokerConsumerEvents>;
  public on: Emitter<SQSBrokerConsumerEvents>['on'];
  public off: Emitter<SQSBrokerConsumerEvents>['off'];

  constructor(options: SQSBrokerConsumerOptions) {
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
      running = false,
    } = options;

    this.onMessage = onMessage;
    this.queueUrl = queueUrl;
    this.sqsClient = sqsClient;
    this.attributeNames = attributeNames;
    this.waitTimeSeconds = waitTimeSeconds;
    this.visibilityTimeout = visibilityTimeout;
    this.maxNumberOfMessages = maxNumberOfMessages;
    this.messageAttributeNames = messageAttributeNames;
    this.pollingWaitTimeMs = pollingWaitTimeMs;
    this.running = running;

    this.emitter = mitt<SQSBrokerConsumerEvents>();
    this.on = this.emitter.on;
    this.off = this.emitter.off;

    if (this.running) {
      this.poll();
    }
  }

  public get isRunning(): boolean {
    return this.running;
  }

  private async deleteMessage(message: Message): Promise<void> {
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      })
    );
  }

  private async receiveMessage(): Promise<Message[]> {
    const response = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: this.attributeNames,
        WaitTimeSeconds: this.waitTimeSeconds,
        VisibilityTimeout: this.visibilityTimeout,
        MaxNumberOfMessages: this.maxNumberOfMessages,
        MessageAttributeNames: this.messageAttributeNames,
      })
    );

    return response?.Messages ?? [];
  }

  private async processMessages(messages: Message[]): Promise<void> {
    if (messages.length > 0) {
      await Promise.all(messages.map(message => this.processMessage(message)));
      this.emitter.emit('response_processed');
    } else {
      this.emitter.emit('empty');
    }
  }

  private async processMessage(message: Message): Promise<void> {
    this.emitter.emit('message_received', message);
    try {
      await this.onMessage(message);
      await this.deleteMessage(message);
      this.emitter.emit('message_processed', message);
    } catch (err) {
      this.emitter.emit('processing_error', [err, message]);
    }
  }

  private poll(): void {
    if (!this.isRunning) {
      this.emitter.emit('stopped');
      return;
    }

    this.receiveMessage()
      .then(messages => this.processMessages(messages))
      .then(() => {
        setTimeout(() => this.poll(), this.pollingWaitTimeMs);
      })
      .catch(err => {
        this.emitter.emit('error', err);
      });
  }

  public start(): void {
    if (!this.running) {
      this.running = true;
      this.poll();
    }
  }

  public stop(): void {
    this.running = false;
  }
}
