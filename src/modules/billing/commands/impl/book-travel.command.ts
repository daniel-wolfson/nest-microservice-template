import { BookingData } from '../../dto/booking-data.dto';

export class BookTravelCommand {
    constructor(public readonly dto: BookingData) {}
}

export class ReserveHotelForBookingCommand {
    constructor(public readonly dto: BookingData) {}
}

export class ReserveFlightForBookingCommand {
    constructor(public readonly dto: BookingData) {}
}

export class ReserveCarRentalForBookingCommand {
    constructor(public readonly dto: BookingData) {}
}
