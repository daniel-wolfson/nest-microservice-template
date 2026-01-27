import { Test, TestingModule } from '@nestjs/testing';
import { KafkaProducerService } from '@src/modules/kafka/kafka-producer.service';
import { ProducerStrategyFactory } from '@src/modules/kafka/producer-strategy.factory';
import { KafkaSettings } from '@src/modules/kafka/kafka-settings';
import { StructuredLogger } from '@src/common/winston.logger';

describe('KafkaProducerService', () => {
    let service: KafkaProducerService;
    let factory: ProducerStrategyFactory;
    let logger: StructuredLogger;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KafkaProducerService,
                {
                    provide: ProducerStrategyFactory,
                    useValue: {
                        createStrategy: jest.fn(),
                        createAtLeastOnceStrategy: jest.fn(),
                        createAtMostOnceStrategy: jest.fn(),
                        createExactlyOnceStrategy: jest.fn(),
                    },
                },
                {
                    provide: KafkaSettings,
                    useValue: {
                        getKafkaConfig: jest.fn().mockReturnValue({
                            clientId: 'test-client',
                            brokers: ['localhost:9092'],
                        }),
                        getProducerSettings: jest.fn().mockReturnValue({
                            maxInFlightRequests: 5,
                            idempotent: false,
                            transactionTimeout: 30000,
                            retry: {
                                initialRetryTime: 100,
                                retries: 5,
                            },
                        }),
                        getConsumerSettings: jest.fn().mockReturnValue({
                            groupId: 'test-group',
                            sessionTimeout: 30000,
                        }),
                    },
                },
                {
                    provide: StructuredLogger,
                    useValue: {
                        log: jest.fn(),
                        error: jest.fn(),
                        warn: jest.fn(),
                        info: jest.fn(),
                        debug: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<KafkaProducerService>(KafkaProducerService);
        factory = module.get<ProducerStrategyFactory>(ProducerStrategyFactory);
        logger = module.get<StructuredLogger>(StructuredLogger);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('sendMessage', () => {
        it('should use strategy to send message', async () => {
            const mockProducer = {
                connect: jest.fn().mockResolvedValue(undefined),
                disconnect: jest.fn().mockResolvedValue(undefined),
                send: jest.fn().mockResolvedValue([{ topicName: 'test-topic' }]),
            };

            const mockStrategy = {
                send: jest.fn().mockResolvedValue([{ topicName: 'test-topic' }]),
                configure: jest.fn(),
                disconnect: jest.fn(),
                getProducer: jest.fn().mockReturnValue(mockProducer),
            };

            jest.spyOn(factory, 'createStrategy').mockResolvedValue(mockStrategy as any);

            const result = await service.send({
                topic: 'test-topic',
                messages: [
                    {
                        key: 'test',
                        value: JSON.stringify('data'),
                    },
                ],
            });

            expect(mockStrategy.send).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });
});
