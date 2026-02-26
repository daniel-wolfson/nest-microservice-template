import { BaseReservation } from '../dto/base-reservation.dto';
import { ReservationResult } from '../dto/reservation-confirm-result.dto';

export interface IReservationService {
    makeReservation(dto: BaseReservation): Promise<ReservationResult>;
    confirmReservation(requestId: string, reservationId: string): Promise<void>;
    cancelReservation(reservationId: string): Promise<void>;
    getReservation(reservationId: string): Promise<ReservationResult | null>;
}
