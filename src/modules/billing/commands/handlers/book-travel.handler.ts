import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { BookTravelCommand } from '../impl/book-travel.command';
import { TravelBookingSaga } from '../../sagas/travel-booking.saga';
import { TravelBookingResponseDto } from '../../dto/travel-booking.dto';

@CommandHandler(BookTravelCommand)
export class BookTravelHandler implements ICommandHandler<BookTravelCommand> {
    private readonly logger = new Logger(BookTravelHandler.name);

    constructor(private readonly travelBookingSaga: TravelBookingSaga) {}

    async execute(command: BookTravelCommand): Promise<BookingExecutionResult> {
        this.logger.log('Executing BookTravelCommand');

        try {
            const result = await this.travelBookingSaga.execute(command.dto);

            if (result.status === 'confirmed') {
                this.logger.log(`Travel booking confirmed: ${result.bookingId}`);
            } else if (result.status === 'compensated') {
                this.logger.warn(`Travel booking failed and compensated: ${result.bookingId}`);
            }

            return result;
        } catch (error: any) {
            this.logger.error(`Failed to execute travel booking: ${error.message}`, error.stack);
            throw error;
        }
    }
}
