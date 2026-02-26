import { Observable } from 'rxjs';

export interface BillingBrokerClient {
    emit<TPayload = unknown>(pattern: string, payload: TPayload): Promise<void>;
    // emit<TResult = unknown, TPayload = unknown>(pattern: unknown, payload: TPayload): Observable<TResult>;
    send<TResult = unknown, TPayload = unknown>(pattern: unknown, payload: TPayload): Observable<TResult>;
    connect(): Promise<void>;
    close(): void;
}
