import { AmqpConnectionManager, RabbitMQModule, RabbitRpcParamsFactory } from '@golevelup/nestjs-rabbitmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { amqpConfig } from './amqp.config';

@Global()
@Module({
    imports: [
        RabbitMQModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                return amqpConfig(configService);
            },
        }),
    ],
    providers: [RabbitRpcParamsFactory, AmqpConnectionManager],
    exports: [RabbitMQModule],
})
export class AmqpModule {}
