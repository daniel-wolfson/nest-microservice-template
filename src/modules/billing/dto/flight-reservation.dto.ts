export interface FlightReservationDto {
    userId: string;
    origin: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    amount: number;
}

export interface FlightReservationResult {
    reservationId: string;
    confirmationCode: string;
    status: 'confirmed' | 'pending';
    amount: number;
}
