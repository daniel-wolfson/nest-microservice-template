type BookingExecutionResult = {
    reservationId: string;
    status: string;
    bookingId;
    travelBookingRequest: any;
    timestamp: number;
    errorMessage: string | null;
};
