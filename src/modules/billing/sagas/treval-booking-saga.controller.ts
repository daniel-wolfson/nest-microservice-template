import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { OrderCreatedEvent } from '../events/impl/order-created.event';
import { CreateInvoiceCommand } from '../commands/impl/create-invoice.command';
import {
    TravelBookingFlightReservationEvent,
    TravelBookingHotelReservationEvent,
    TravelBookingCarRentalReservationEvent,
} from '../events/impl/booking-reservation-event';
import { FlightService } from '../services/flight.service';
import { HotelService } from '../services/hotel.service';
import { CarRentalService } from '../services/car-rental.service';
import { HotelReservationDto } from '../dto/hotel-reservation.dto';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

@Controller()
export class BookingSagaMessageController {
    private readonly logger = new Logger(BookingSagaMessageController.name);

    constructor(
        private readonly commandBus: CommandBus,
        private readonly eventBus: EventBus,
        private readonly flightService: FlightService,
        private readonly hotelService: HotelService,
        private readonly carRentalService: CarRentalService,
    ) {}

    /**
     * Handle reservation.hotel.requested events from Booking saga service
     */
    @EventPattern('reservation.hotel.requested')
    async handleReservationHotelRequested(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received reservation.hotel.requested event: ${JSON.stringify(data)}`);

        try {
            // Acknowledge the message
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.ack(originalMsg);

            // Validate DTO
            const hotelDto = plainToClass(HotelReservationDto, {
                userId: data.userId,
                hotelId: data.hotelId,
                checkInDate: data.checkInDate,
                checkOutDate: data.checkOutDate,
                amount: data.totalAmount, // * 0.35 => 35% of total
            });
            const errors = await validate(hotelDto);
            if (errors.length > 0) {
                const errorMessages = errors.map(err => Object.values(err.constraints || {})).flat();
                throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
            }

            // reservation-step 2: Reserve Hotel
            var hotelReservation = await this.hotelService.reserveHotel(hotelDto);
            this.logger.log(`✓ Step 2 Complete: Hotel Reserved (${hotelReservation.reservationId})`);

            // Publish internal event
            this.eventBus.publish(
                new TravelBookingHotelReservationEvent(
                    data.bookingId,
                    data.userId,
                    data.hotelId,
                    data.totalAmount,
                    new Date(data.timestamp),
                ),
            );

            this.logger.log(`Order created event processed successfully`);
        } catch (error: any) {
            this.logger.error(`Failed to process order.created event: ${error?.message}`);
            // Optionally, nack the message for retry
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.nack(originalMsg, false, true);
        }
    }

    /**
     * Handle reservation.hotel.confirmed events
     */
    @EventPattern('reservation.hotel.confirmed')
    async handleReservationHotelConfirmed(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received reservation.hotel.confirmed event: ${JSON.stringify(data)}`);

        try {
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();

            // Log confirmation details
            this.logger.log(
                `✅ Hotel reservation confirmed - Booking ID: ${data.bookingId}, Reservation ID: ${data.reservationId}`,
            );

            // Publish domain event for saga coordination
            this.eventBus.publish(
                new TravelBookingHotelReservationEvent(
                    data.bookingId,
                    data.userId,
                    data.reservationId,
                    data.amount,
                    new Date(data.timestamp),
                ),
            );

            // Acknowledge successful processing
            channel.ack(originalMsg);
            this.logger.log(`Hotel confirmation processed successfully: ${data.reservationId}`);
        } catch (error: any) {
            this.logger.error(`Failed to process reservation.hotel.confirmed: ${error?.message}`);
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.nack(originalMsg, false, true);
        }
    }

    /**
     * Handle reservation.flight.confirmed events
     */
    @EventPattern('reservation.flight.confirmed')
    async handleReservationFlightConfirmed(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received reservation.flight.confirmed event: ${JSON.stringify(data)}`);

        try {
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();

            // Log confirmation details
            this.logger.log(
                `✅ Flight reservation confirmed - Booking ID: ${data.bookingId}, Reservation ID: ${data.reservationId}`,
            );

            // Publish domain event for saga coordination
            this.eventBus.publish(
                new TravelBookingFlightReservationEvent(
                    data.bookingId,
                    data.userId,
                    data.reservationId,
                    data.amount,
                    new Date(data.timestamp),
                ),
            );

            // Acknowledge successful processing
            channel.ack(originalMsg);
            this.logger.log(`Flight confirmation processed successfully: ${data.reservationId}`);
        } catch (error: any) {
            this.logger.error(`Failed to process reservation.flight.confirmed: ${error?.message}`);
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.nack(originalMsg, false, true);
        }
    }

    /**
     * Handle reservation.carRental.confirmed events
     */
    @EventPattern('reservation.carRental.confirmed')
    async handleReservationCarRentalConfirmed(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received reservation.carRental.confirmed event: ${JSON.stringify(data)}`);

        try {
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();

            // Log confirmation details
            this.logger.log(
                `✅ Car rental reservation confirmed - Booking ID: ${data.bookingId}, Reservation ID: ${data.reservationId}`,
            );

            // Publish domain event for saga coordination
            this.eventBus.publish(
                new TravelBookingCarRentalReservationEvent(
                    data.bookingId,
                    data.userId,
                    data.reservationId,
                    data.amount,
                    new Date(data.timestamp),
                ),
            );

            // Acknowledge successful processing
            channel.ack(originalMsg);
            this.logger.log(`Car rental confirmation processed successfully: ${data.reservationId}`);
        } catch (error: any) {
            this.logger.error(`Failed to process reservation.carRental.confirmed: ${error?.message}`);
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.nack(originalMsg, false, true);
        }
    }
}
