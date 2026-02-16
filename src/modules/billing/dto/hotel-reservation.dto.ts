export interface HotelReservationDto {
    userId: string;
    hotelId: string;
    checkInDate: string;
    checkOutDate: string;
    amount: number;
}

export interface HotelReservationResult {
    reservationId: string;
    confirmationCode: string;
    status: 'confirmed' | 'pending';
    amount: number;
}
