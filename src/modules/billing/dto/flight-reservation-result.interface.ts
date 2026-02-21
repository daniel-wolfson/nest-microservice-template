import { SagaStatus } from '../sagas/saga-status.enum';

export interface IFlightReservationResult {
    reservationId: string;
    confirmationCode: string;
    status: SagaStatus;
    amount: number;
}
