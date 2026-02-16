import { TravelBookingDto } from '../../dto/travel-booking.dto';

export class BookTravelCommand {
    constructor(public readonly dto: TravelBookingDto) {}
}
