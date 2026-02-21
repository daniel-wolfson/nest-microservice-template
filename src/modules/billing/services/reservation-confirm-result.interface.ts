import { SagaStatus } from '../sagas/saga-status.enum';

export interface IReservationConfirmResult {
    reservationId: string;
    confirmationCode: string;
    status: SagaStatus;
    amount: number;
}
