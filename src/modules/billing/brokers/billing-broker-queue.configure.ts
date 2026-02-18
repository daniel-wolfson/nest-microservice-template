import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

// Configure RabbitMQ microservice options (if needed, can be moved to a separate file)
export function configureRabbitMessageQueues(app: INestApplication<any>, configService: ConfigService) {
    const rabbitmq_url =
        configService.get<string>('RABBITMQ_URL') ||
        (() => {
            throw new Error('RABBITMQ_URL is not defined');
        })();

    const username = configService.get<string>('RABBITMQ_DEFAULT_USER', 'guest');
    const password = configService.get<string>('RABBITMQ_DEFAULT_PASS', 'guest');

    // Define message queues based on hospitality industry domains
    const hospitalityQueues = [
        {
            name: 'reservation_hotel_queue',
            options: { durable: true },
        },
        {
            name: 'reservation_flight_queue',
            options: { durable: true },
        },
        {
            name: 'reservation_car_rental_queue',
            options: { durable: true },
        },
        {
            // For processing payments, refunds, and charges.
            // This requires high durability and reliability.
            name: 'payment_queue',
            options: { durable: true },
        },
        {
            // For sending notifications like booking confirmations, reminders, and marketing messages.
            name: 'notification_queue',
            options: { durable: true },
        },
        {
            // For managing housekeeping tasks, room status updates, and maintenance requests.
            name: 'housekeeping_queue',
            options: { durable: true },
        },
        {
            // For logging user activities and system events for analytics and business intelligence.
            // Durability can be slightly relaxed for higher throughput if some data loss is acceptable.
            name: 'analytics_queue',
            options: { durable: false },
        },
    ];

    hospitalityQueues.forEach(queueConfig => {
        app.connectMicroservice({
            transport: Transport.RMQ,
            options: {
                urls: [rabbitmq_url],
                username: username,
                password: password,
                queue: queueConfig.name,
                queueOptions: queueConfig.options,
                prefetchCount: 1, // Process one message at a time to ensure order and reliability
                noAck: false, // Manual acknowledgment is crucial for ensuring messages are processed
            },
        });
    });
}

export function configureKafkaMessageQueues(app: INestApplication<any>, configService: ConfigService) {
    const kafka_brokers = (configService.get<string>('KAFKA_BROKERS') || 'localhost:9092').split(',');

    // Define Kafka topics based on hospitality industry domains
    // Hospitality-related topics would be consumed by controllers using @MessagePattern decorator.
    // e.g. @MessagePattern('booking_topic')
    const hospitalityTopics = [
        {
            // For handling new bookings, cancellations, and modifications.
            clientId: 'hotel-booking-consumer',
            groupId: 'hotel-booking-group',
            topics: ['booking_topic'],
        },
        {
            // For processing payments, refunds, and charges.
            clientId: 'hotel-payment-consumer',
            groupId: 'hotel-payment-group',
            topics: ['payment_topic'],
        },
        {
            // For sending notifications like booking confirmations, reminders, and marketing messages.
            clientId: 'hotel-notification-consumer',
            groupId: 'hotel-notification-group',
            topics: ['notification_topic'],
        },
        {
            // For managing housekeeping tasks, room status updates, and maintenance requests.
            clientId: 'hotel-housekeeping-consumer',
            groupId: 'hotel-housekeeping-group',
            topics: ['housekeeping_topic'],
        },
        {
            // For logging user activities and system events for analytics and business intelligence.
            clientId: 'hotel-analytics-consumer',
            groupId: 'hotel-analytics-group',
            topics: ['analytics_topic'],
        },
    ];

    hospitalityTopics.forEach(topicConfig => {
        app.connectMicroservice<MicroserviceOptions>({
            transport: Transport.KAFKA,
            options: {
                client: {
                    clientId: topicConfig.clientId,
                    brokers: kafka_brokers,
                },
                consumer: {
                    groupId: topicConfig.groupId,
                    allowAutoTopicCreation: true,
                },
                subscribe: {
                    fromBeginning: false,
                    topics: topicConfig.topics,
                },
            },
        });
    });
}
