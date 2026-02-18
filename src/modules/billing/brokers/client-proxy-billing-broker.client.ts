import { firstValueFrom, Observable } from 'rxjs';
import { BillingBrokerClient } from './billing-broker-client.interface';
import { ClientProxy } from '@nestjs/microservices';

type EmittableClient = {
    emit<TResult = unknown, TPayload = unknown>(pattern: unknown, payload: TPayload): Observable<TResult>;
    send<TResult = unknown, TPayload = unknown>(pattern: unknown, payload: TPayload): Observable<TResult>;
    connect(): Promise<void>;
    close(): void;
};

export interface IMessageClientProxy extends Pick<ClientProxy, 'send' | 'emit' | 'connect' | 'close'> {}

export class ClientProxyBillingBrokerClient implements BillingBrokerClient {
    constructor(private readonly client: IMessageClientProxy) {}

    async emit<TPayload = unknown>(pattern: string, payload: TPayload): Promise<void> {
        await firstValueFrom(this.client.emit(pattern, payload));
    }

    send<TPayload = unknown, TResult = unknown>(pattern: string, payload: TPayload): Observable<TResult> {
        return this.client.send<TResult, TPayload>(pattern, payload);
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    close(): void {
        this.client.close();
    }
}
