import { Injectable } from '@nestjs/common';
import { KafkaSettings } from './kafka-settings';
import { DeliverySemantics } from './delivery-semantics-strategy.enum';
import { IProducerDeliveryStrategy } from './producer-delivery-strategy.interface';
import { AtLeastOnceProducerStrategy } from './producer-atLeastOnce.strategy';
import { AtMostOnceProducerStrategy } from './producer-atMostOnce.strategy';
import { ExactlyOnceProducerStrategy } from './producer.exactlyOnce.strategy';
import { StructuredLogger } from 'src/common/winston.logger';

@Injectable()
export class ProducerStrategyFactory {
    constructor(private readonly kafkaSettings: KafkaSettings, private readonly logger: StructuredLogger) {}

    /// Creates a producer delivery strategy based on the provided delivery semantics.
    async createStrategy(): Promise<IProducerDeliveryStrategy>;
    async createStrategy(deliveryStrategy: DeliverySemantics): Promise<IProducerDeliveryStrategy>;
    async createStrategy(deliveryStrategy?: DeliverySemantics): Promise<IProducerDeliveryStrategy> {
        let strategy: IProducerDeliveryStrategy;

        deliveryStrategy =
            deliveryStrategy ??
            this.kafkaSettings.getProducerSettings().deliveryStrategy ??
            DeliverySemantics.AT_LEAST_ONCE;

        switch (deliveryStrategy) {
            case DeliverySemantics.AT_MOST_ONCE:
                strategy = new AtMostOnceProducerStrategy(this.kafkaSettings);
                break;
            case DeliverySemantics.AT_LEAST_ONCE:
                strategy = new AtLeastOnceProducerStrategy(this.kafkaSettings);
                break;
            case DeliverySemantics.EXACTLY_ONCE:
                strategy = new ExactlyOnceProducerStrategy(this.kafkaSettings);
                break;
            default:
                // Default to AtLeastOnce for reliability
                strategy = new AtLeastOnceProducerStrategy(this.kafkaSettings);
        }

        // Configure the strategy before returning
        await strategy.configure();
        return strategy;
    }

    async createAtMostOnceStrategy(): Promise<AtMostOnceProducerStrategy> {
        const strategy = new AtMostOnceProducerStrategy(this.kafkaSettings);
        await strategy.configure();
        return strategy;
    }

    async createAtLeastOnceStrategy(): Promise<AtLeastOnceProducerStrategy> {
        const strategy = new AtLeastOnceProducerStrategy(this.kafkaSettings);
        await strategy.configure();
        return strategy;
    }

    async createExactlyOnceStrategy(): Promise<ExactlyOnceProducerStrategy> {
        const strategy = new ExactlyOnceProducerStrategy(this.kafkaSettings);
        await strategy.configure();
        return strategy;
    }
}
