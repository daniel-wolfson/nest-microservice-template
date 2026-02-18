export interface BillingBrokerClient {
    emit<TPayload = unknown>(pattern: string, payload: TPayload): Promise<void>;
}
