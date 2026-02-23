import { BaseReservationDto } from "../dto/base-reservation.dto";
import { IReservationConfirmResult } from "./reservation-confirm-result.interface";

export interface IReservationService {
    makeReservation(dto: BaseReservationDto): Promise<IReservationConfirmResult>;
    confirmReservation(requestId: string, reservationId: string): Promise<void>;
    cancelReservation(reservationId: string): Promise<void>;
    getReservation(reservationId: string): Promise<IReservationConfirmResult | null>;
}