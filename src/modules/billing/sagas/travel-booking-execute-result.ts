import { SagaStatus } from './saga-status.enum';

export type TravelBookingExecutionResult = {
    requestId: string;
    bookingId?: string | null;
    originalRequest: any;
    status: SagaStatus;
    timestamp: number;
    message?: string | null;
};
