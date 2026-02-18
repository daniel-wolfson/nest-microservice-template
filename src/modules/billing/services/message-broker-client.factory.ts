import { ConfigService } from '@nestjs/config';
import { KafkaOptions, RmqOptions, Transport } from '@nestjs/microservices';

export const messageBrokerClientOptionsFactory = (config: ConfigService): KafkaOptions | RmqOptions => {
    const broker = config.get<'kafka' | 'rabbit'>('MESSAGE_BROKER');

    if (broker === 'kafka') {
        return {
            transport: Transport.KAFKA,
            options: {
                client: {
                    clientId: 'hotel-gateway',
                    brokers: config.get<string>('KAFKA_BROKERS')!.split(','),
                },
                consumer: {
                    groupId: 'hotel-gateway-group',
                },
            },
        };
    }

    return {
        transport: Transport.RMQ,
        options: {
            urls: [config.get<string>('RABBITMQ_URL')!],
            queue: config.get<string>('RABBITMQ_QUEUE')!,
            queueOptions: { durable: true },
        },
    };
};
