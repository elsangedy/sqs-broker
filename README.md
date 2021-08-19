# sqs-broker

## Install

```bash
$ yarn add sqs-broker
```

## Usage

### Basic

```ts
const consumer = new SQSBrokerConsumer({
  queueUrl: '...',
  onMessage: async message => {
    console.log(message.Body);
  },
});
consumer.start();
```

### Custom

```ts
const sqsClient = new SQSClient({
  region: 'us-east-1',
  // accessKeyId: '',
  // secretAccessKey: '',
  endpoint: 'http://localhost:4566',
});
const consumer = new SQSBrokerConsumer({
  sqsClient,
  queueUrl: '...',
  maxNumberOfMessages: 10,
  onMessage: async message => {
    console.log(message.Body);
  },
});
consumer.start();
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

const consumer = new SQSBrokerConsumer({
  queueUrl: '...',
  onMessage: async message => {
    console.log(message.Body);
  },
});
consumer.on('*', console.log);
consumer.on('message_received', console.log);
consumer.off('message_received', console.log);
consumer.start();
```

### Producer

```ts
const producer = new SQSBrokerProducer({
  queueUrl: '...',
});

producer.send('My message');
producer.send({
  id: 'my-id',
  body: 'My message',
  delaySeconds: 10,
});
producer.send(['My message 1', 'My message 2']);
producer.send([
  { id: 'my-id-1', body: 'My message 1' },
  { id: 'my-id-2', body: 'My message 2' },
]);
```
