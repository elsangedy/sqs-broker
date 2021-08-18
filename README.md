# sqs-broker

## Instalation

```bash
$ yarn add sqs-broker
```

## Examples

### Basic

```ts
const broker = createSQSBrokerConsumer({
  queueUrl: '...',
  onMessage: async message => {
    console.log(message.Body);
  },
});
broker.start();
```

### Custom

```ts
const sqsClient = new SQSClient({
  region: 'us-east-1',
  // accessKeyId: '',
  // secretAccessKey: '',
  endpoint: 'http://localhost:4566',
});
const broker = createSQSBrokerConsumer({
  sqsClient,
  queueUrl: '...',
  maxNumberOfMessages: 10,
  onMessage: async message => {
    console.log(message.Body);
  },
});
broker.start();
```

### Events

```ts
type SQSBrokerConsumerEvents = {
  empty: void;
  stopped: void;
  response_processed: void;
  message_received: Message;
  message_processed: Message;
  error: Error | [Error, Message];
  processing_error: [Error, Message];
};

const broker = createSQSBrokerConsumer({
  queueUrl: '...',
  onMessage: async message => {
    console.log(message.Body);
  },
});
broker.on('*', console.log);
broker.on('message_received', console.log);
broker.off('message_received', console.log);
broker.start();
```
