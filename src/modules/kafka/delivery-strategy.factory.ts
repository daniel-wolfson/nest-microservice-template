import { AtLeastOnceConsumerStrategy } from './consumer-atLeastOnce.strategy';
import { DeliverySemantics } from './delivery-semantics-strategy.enum';
import { IProducerDeliveryStrategy } from './producer-delivery-strategy.interface';
import { IConsumerDeliveryStrategy } from './consumer-delivery-strategy,interface';
import { AtMostOnceProducerStrategy } from './producer-atMostOnce.strategy';
import { AtLeastOnceProducerStrategy } from './producer-atLeastOnce.strategy';
import { ExactlyOnceProducerStrategy } from './producer.exactlyOnce.strategy';
import { AtMostOnceConsumerStrategy } from './consumer-atMostOnce.strategy';
import { ExactlyOnceConsumerStrategy } from './consumer-exactlyOnce.strategy';
import { KafkaSettings } from './kafka-settings';

// Factory Implementation

export class DeliveryStrategyFactory {
    static createProducerStrategy<T = any>(
        semantics: DeliverySemantics,
        settings: KafkaSettings,
    ): IProducerDeliveryStrategy<T> {
        switch (semantics) {
            case DeliverySemantics.AT_MOST_ONCE:
                return new AtMostOnceProducerStrategy<T>(settings);
            case DeliverySemantics.AT_LEAST_ONCE:
                return new AtLeastOnceProducerStrategy<T>(settings);
            case DeliverySemantics.EXACTLY_ONCE:
                return new ExactlyOnceProducerStrategy<T>(settings);
            default:
                return new AtMostOnceProducerStrategy<T>(settings);
        }
    }

    static createConsumerStrategy(semantics: DeliverySemantics, settings: KafkaSettings): IConsumerDeliveryStrategy {
        switch (semantics) {
            case DeliverySemantics.AT_MOST_ONCE:
                return new AtMostOnceConsumerStrategy(settings);
            case DeliverySemantics.AT_LEAST_ONCE:
                return new AtLeastOnceConsumerStrategy(settings);
            case DeliverySemantics.EXACTLY_ONCE:
                return new ExactlyOnceConsumerStrategy(settings);
            default:
                return new AtMostOnceConsumerStrategy(settings);
        }
    }
}
