export interface KafkaConnectionSettings {
    brokers: string[];
    clientId: string;
    ssl?: boolean;
    sasl?: {
        mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
        username: string;
        password: string;
    };
    connectionTimeout?: number;
    requestTimeout?: number;
    retry?: {
        initialRetryTime?: number;
        retries?: number;
    };
}
