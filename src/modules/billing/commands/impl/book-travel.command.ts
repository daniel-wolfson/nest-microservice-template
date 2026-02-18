import { TravelBookingRequestDto } from '../../dto/travel-booking.dto';

export class BookTravelCommand {
    constructor(public readonly dto: TravelBookingRequestDto) {}
}

export class ReserveHotelForBookingCommand {
    constructor(public readonly dto: TravelBookingRequestDto) {}
}

export class ReserveFlightForBookingCommand {
    constructor(public readonly dto: TravelBookingRequestDto) {}
}

export class ReserveCarRentalForBookingCommand {
    constructor(public readonly dto: TravelBookingRequestDto) {}
}
