import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BookTravelCommand as TravelBookingCommand } from '../impl/book-travel.command';
import { TravelBookingSaga } from '../../sagas/travel-booking.saga';
import { TravelBookingExecutionResult } from '../../sagas/travel-booking-execute-result';

@CommandHandler(TravelBookingCommand)
export class TravelBookingHandler implements ICommandHandler<TravelBookingCommand> {
    private readonly logger = new Logger(TravelBookingHandler.name);
    constructor(private readonly travelBookingSaga: TravelBookingSaga) {}
    async execute(command: TravelBookingCommand): Promise<TravelBookingExecutionResult> {
        this.logger.log('Executing TravelBookingCommand');

        try {
            const result = await this.travelBookingSaga.execute(command.dto);
            this.logger.log(`Travel booking: ${result.bookingId} status: ${result.status}`);
            return result;
        } catch (error: any) {
            this.logger.error(`Failed to execute travel booking: ${error.message}`, error.stack);
            throw error;
        }
    }
}
