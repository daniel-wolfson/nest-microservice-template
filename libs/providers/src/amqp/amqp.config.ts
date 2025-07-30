// import { RabbitMQConfig, RabbitMQExchangeConfig } from '@golevelup/nestjs-rabbitmq';
// import { ConfigService } from '@nestjs/config';

// const AMQP_EXCHANGES: RabbitMQExchangeConfig[] = [];

// export const amqpConfig = (configService: ConfigService): RabbitMQConfig => {
//     const connectionString = configService.get<string>('RABBITMQ_URL');
//     if (!connectionString) {
//         throw new Error('ENV: "RABBITMQ_URL" not found. Check ".env" file or server variables.');
//     }
//     return {
//         exchanges: AMQP_EXCHANGES,
//         uri: connectionString,
//         connectionInitOptions: { wait: false },
//         connectionManagerOptions: {
//             heartbeatIntervalInSeconds: 15,
//             reconnectTimeInSeconds: 30,
//         },
//     };
// };

import { Logger } from '@nestjs/common';
import { RabbitMQConfig, RabbitMQExchangeConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';

const AMQP_EXCHANGES: RabbitMQExchangeConfig[] = [
    {
        name: 'default.exchange',
        type: 'topic',
        options: {
            durable: true,
        },
    },
];

export const amqpConfig = (configService: ConfigService): RabbitMQConfig => {
    const logger = new Logger('AMQP Configuration');

    const connectionString =
        configService.get<string>('RABBITMQ_URL') || process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672';

    logger.log(`Attempting to connect to RabbitMQ: ${connectionString.replace(/\/\/.*@/, '//***:***@')}`);

    if (!connectionString) {
        const error = 'ENV: "RABBITMQ_URL" not found. Check ".env" file or server variables.';
        logger.error(error);
        throw new Error(error);
    }

    return {
        exchanges: AMQP_EXCHANGES,
        uri: connectionString,
        connectionInitOptions: {
            wait: false,
            timeout: 20000,
        },
        connectionManagerOptions: {
            heartbeatIntervalInSeconds: 15,
            reconnectTimeInSeconds: 30,
            connectionOptions: {
                timeout: 20000,
            },
        },
        prefetchCount: 10,
        channels: {
            'channel-1': {
                prefetchCount: 15,
                default: true,
            },
        },
    };
};
