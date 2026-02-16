export interface CarRentalReservationDto {
    userId: string;
    pickupLocation: string;
    dropoffLocation: string;
    pickupDate: string;
    dropoffDate: string;
    amount: number;
}

export interface CarRentalReservationResult {
    reservationId: string;
    confirmationCode: string;
    status: 'confirmed' | 'pending';
    amount: number;
}
