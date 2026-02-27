import { ReservationStatus } from './saga-status.enum';

export type TravelBookingExecutionResult = {
    requestId: string;
    bookingId?: string | null;
    originalRequest: any;
    status: ReservationStatus;
    timestamp: string;
    message?: string | null;
};
