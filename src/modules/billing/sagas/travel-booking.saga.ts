import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { FlightService } from '../services/flight.service';
import { HotelService } from '../services/hotel.service';
import { CarRentalService } from '../services/car-rental.service';
import { BookingData as BookingRequestDto, TravelBookingResponseDto } from '../dto/booking-data.dto';
import { FlightReservationDto } from '../dto/flight-reservation.dto';
import { IFlightReservationResult } from '../dto/flight-reservation-result.interface';
import { HotelReservationDto } from '../dto/hotel-reservation.dto';
import { HotelReservationResult } from '../dto/hotel-reservation-result.dto';
import { CarRentalReservationDto } from '../dto/car-rental-reservation.dto';
import { IReservationConfirmResult } from '../services/reservation-confirm-result.interface';
import { CompensationFailedEvent } from '../events/impl/compensation-failed.event';
import { BILLING_BROKER_CLIENT } from '../brokers/billing-broker.constants';
import { BillingBrokerClient } from '../brokers/billing-broker-client.interface';
import { randomUUID, UUID } from 'crypto';
import { TravelBookingSagaStateRepository } from './travel-booking-saga-state.repository';
import { SagaCoordinator } from './saga-coordinator.service';
import { SagaStatus } from './travel-booking-saga-state.schema';

/**
 * Travel Booking Saga Orchestrator - Hybrid MongoDB + Redis Architecture
 *
 * Implements the Saga pattern for distributed transactions across multiple services:
 * Flight → Hotel → Car Rental → Payment
 *
 * PERSISTENCE LAYER:
 * - MongoDB (via sagaStateRepository): Durable storage for audit, recovery, analytics
 * - Redis (via sagaCoordinator): Fast coordination for locks, caching, rate limiting
 *
 * COORDINATION FEATURES:
 * - Distributed locks: Prevent duplicate saga execution
 * - Rate limiting: Prevent spam bookings (5 per minute per user)
 * - In-flight caching: Fast state access during saga execution
 * - Pending queue: Monitor stuck sagas for recovery
 * - Step tracking: Real-time progress monitoring
 *
 * If any step fails, compensation transactions are executed in reverse order:
 * Cancel Car → Cancel Hotel → Cancel Flight
 *
 * This ensures eventual consistency and handles failure scenarios gracefully.
 */
@Injectable()
export class TravelBookingSaga {
    private readonly logger = new Logger(TravelBookingSaga.name);

    constructor(
        private readonly flightService: FlightService,
        private readonly hotelService: HotelService,
        private readonly carRentalService: CarRentalService,
        private readonly eventBus: EventBus,
        @Inject(BILLING_BROKER_CLIENT)
        private readonly billingBrokerClient: BillingBrokerClient,
        private readonly sagaStateRepository: TravelBookingSagaStateRepository,
        private readonly sagaCoordinator: SagaCoordinator,
    ) {}

    /**
     * Execute the travel booking saga - Hybrid MongoDB + Redis approach
     *
     * Redis: Distributed lock, rate limiting, in-flight cache, pending queue
     * MongoDB: Persistent state for audit trail and recovery
     *
     * Returns a response with the booking status and details
     */
    async execute(request: BookingRequestDto): Promise<BookingExecutionResult> {
        // saga-execute-step 0: Generate idempotency key for duplicate detection
        const reservationId = request.reservationId || this.generateIdempotencyKey(request);
        this.logger.log(`Processing travel booking with idempotency key: ${reservationId}`);
        this.logger.log(`User: ${request.userId}, Total Amount: $${request.totalAmount}`);

        let lockAcquired = false;
        let bookingId: string | null = null;
        let bookingExecutionResult: BookingExecutionResult = {
            reservationId: reservationId as UUID,
            bookingId: null,
            travelBookingRequest: request,
            timestamp: new Date().getTime(),
            status: null,
            message: null,
        };

        try {
            // saga-execute-step 1: MONGODB: Check if saga already exists (completed or in-progress)
            const existingSaga = await this.sagaStateRepository.findByReservationId(reservationId);
            if (existingSaga) {
                this.logger.log(`✅ Duplicate request detected, returning existing saga: ${existingSaga.bookingId}`);
                return {
                    reservationId: existingSaga.reservationId as UUID,
                    bookingId: existingSaga.bookingId,
                    travelBookingRequest: request,
                    timestamp: existingSaga.sagaTimestamp,
                    status: this.mapSagaStatusToString(existingSaga.status),
                    message: existingSaga.errorMessage || null,
                };
            }

            // saga-execute-step 2: REDIS. Check if saga is currently in-flight (race condition protection)
            const inFlightState = await this.sagaCoordinator.getInFlightState(reservationId);
            if (inFlightState) {
                this.logger.log(`⚠️ Saga already in-flight in Redis: ${reservationId}`);
                return {
                    reservationId,
                    bookingId: inFlightState.bookingId || null,
                    travelBookingRequest: request,
                    timestamp: inFlightState.startTime || new Date().getTime(),
                    status: 'pending',
                    message: `saga already in progress for ${reservationId}, please wait for completion or check later`,
                };
            }

            // saga-execute-step 3: Acquire distributed lock using idempotency key (prevent duplicate saga execution)
            lockAcquired = await this.sagaCoordinator.acquireSagaLock(reservationId, 300);
            if (!lockAcquired) {
                const errorMsg = `Saga already in progress for reservation: ${reservationId}`;
                this.logger.warn(`⚠️ ${errorMsg}`);
                bookingExecutionResult.status = 'failed';
                bookingExecutionResult.message = errorMsg;
                return bookingExecutionResult;
            }

            // saga-execute-step 4: Check rate limit (prevent spam bookings)
            const canProceed = await this.sagaCoordinator.checkRateLimit(request.userId, 5);
            if (!canProceed) {
                throw new Error(`Rate limit exceeded for user: ${request.userId}`);
            }

            // Generate bookingId ONLY after all duplicate checks pass
            bookingId = this.generateBookingId();
            bookingExecutionResult.bookingId = bookingId;
            this.logger.log(`Generated new bookingId: ${bookingId}`);

            // saga-execute-step 5: MONGODB: Save persistent state for audit and recovery
            await this.sagaStateRepository.create({
                bookingId,
                reservationId,
                userId: request.userId,
                status: SagaStatus.PENDING,
                originalRequest: request as any,
                totalAmount: request.totalAmount,
                sagaTimestamp: Date.now(),
                completedSteps: [],
            });
            this.logger.log(`✅ Saga state saved to MongoDB: ${bookingId}`);

            // saga-execute-step 6: REDIS. Cache in-flight state for fast reads (keyed by idempotencyKey)
            await this.sagaCoordinator.cacheInFlightState(
                reservationId,
                {
                    bookingId,
                    reservationId,
                    userId: request.userId,
                    status: 'PENDING',
                    startTime: Date.now(),
                    totalAmount: request.totalAmount,
                },
                3600,
            );

            // saga-execute-step 7: Add to pending queue for monitoring
            await this.sagaCoordinator.addToPendingQueue(bookingId);

            // saga-execute-step 8: publish hotel reservation request
            await this.billingBrokerClient.emit('reservation.hotel.requested', this.reserveHotel(request));
            this.logger.log(`✅ reservation.hotel.requested event published: ${reservationId}`);
            await this.sagaCoordinator.incrementStepCounter(bookingId, 'hotel_requested');

            // saga-execute-step 9: publish flight reservation request
            await this.billingBrokerClient.emit('reservation.flight.requested', this.reserveFlight(request));
            this.logger.log(`✅ reservation.flight.requested event published: ${reservationId}`);
            await this.sagaCoordinator.incrementStepCounter(bookingId, 'flight_requested');

            // saga-execute-step 10: publish car rental reservation request
            await this.billingBrokerClient.emit('reservation.carRental.requested', this.reserveCar(request));
            this.logger.log(`✅ reservation.carRental.requested event published: ${reservationId}`);
            await this.sagaCoordinator.incrementStepCounter(bookingId, 'car_requested');

            bookingExecutionResult.status = 'pending';
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`❌ Failed to publish travel booking request: ${errorMessage}`, errorStack);

            // saga-execute-step 11: MONGODB: Save error state (only if bookingId was generated)
            if (bookingId) {
                await this.sagaStateRepository.setError(bookingId, errorMessage, errorStack);
            }

            // saga-execute-step 12: REDIS: Set error metadata (using idempotencyKey for tracking)
            await this.sagaCoordinator.setSagaMetadata(reservationId, {
                error: errorMessage,
                failedAt: Date.now().toString(),
                bookingId: bookingId || 'not_generated',
            });

            bookingExecutionResult.status = 'failed';
            bookingExecutionResult.message = errorMessage;
        } finally {
            // saga-execute-step 13: REDIS: Release distributed lock (using idempotencyKey)
            if (lockAcquired) {
                await this.sagaCoordinator.releaseSagaLock(reservationId);
            }
            // saga-execute-step 14: REDIS: Clear in-flight cache on completion or error
            await this.sagaCoordinator.clearInFlightState(reservationId);
        }
        return bookingExecutionResult;
    }

    async execute_old(dto: BookingRequestDto): Promise<TravelBookingResponseDto> {
        const bookingId = this.generateBookingId();
        let flightReservation: IFlightReservationResult | null = null;
        let hotelReservation: HotelReservationResult | null = null;
        let carRentalReservation: IReservationConfirmResult | null = null;

        this.logger.log(`Starting Travel Booking Saga: ${bookingId}`);
        this.logger.log(`User: ${dto.userId}, Total Amount: $${dto.totalAmount}`);

        try {
            // Step 1: Reserve Flight
            flightReservation = await this.reserveFlight(dto);
            this.logger.log(`✓ Step 1 Complete: Flight Reserved (${flightReservation.reservationId})`);

            // Step 2: Reserve Hotel
            hotelReservation = await this.reserveHotel(dto);
            this.logger.log(`✓ Step 2 Complete: Hotel Reserved (${hotelReservation.reservationId})`);

            // Step 3: Reserve Car
            carRentalReservation = await this.reserveCar(dto);
            this.logger.log(`✓ Step 3 Complete: Car Reserved (${carRentalReservation.reservationId})`);

            // Step 4: Process Payment (simulated)
            await this.processPayment(dto.userId, dto.totalAmount);
            this.logger.log(`✓ Step 4 Complete: Payment Processed`);

            // All steps successful
            this.logger.log(`✅ Travel Booking Saga Completed Successfully: ${bookingId}`);

            return {
                bookingId,
                travelBookingRequest: dto,
                flightReservationId: flightReservation.reservationId,
                hotelReservationId: hotelReservation.reservationId,
                carRentalReservationId: carRentalReservation.reservationId,
                status: 'confirmed',
                timestamp: new Date(),
            };
        } catch (error) {
            // Saga failed - execute compensating transactions
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Travel Booking Saga Failed: ${errorMessage}`);
            this.logger.warn(`🔄 Starting Compensation Process...`);

            await this.compensate(bookingId, flightReservation, hotelReservation, carRentalReservation);

            return {
                bookingId,
                travelBookingRequest: dto,
                flightReservationId: flightReservation?.reservationId || null,
                hotelReservationId: hotelReservation?.reservationId || null,
                carRentalReservationId: carRentalReservation?.reservationId || null,
                status: 'compensated',
                errorMessage,
                timestamp: new Date(),
            };
        }
    }

    async aggregateResults(bookingId: string): Promise<TravelBookingResponseDto> {
        this.logger.log(`Aggregating results for booking: ${bookingId}`);
        try {
            // MONGODB: Read state — reservation IDs already saved by event handlers
            const sagaState = await this.sagaStateRepository.findByBookingId(bookingId);

            if (!sagaState) {
                throw new Error(`Saga state not found for booking: ${bookingId}`);
            }

            const { flightReservationId, hotelReservationId, carRentalReservationId } = sagaState;

            if (!flightReservationId || !hotelReservationId || !carRentalReservationId) {
                throw new Error(
                    `Incomplete reservation IDs for booking ${bookingId}: ` +
                        `flight=${flightReservationId}, hotel=${hotelReservationId}, car=${carRentalReservationId}`,
                );
            }

            // MONGODB: Finalize status only — IDs are already persisted
            await this.sagaStateRepository.updateState(bookingId, {
                status: SagaStatus.CONFIRMED,
                completedSteps: ['flight_confirmed', 'hotel_confirmed', 'car_confirmed', 'aggregated'],
            });

            this.logger.log(`✅ Saga state confirmed in MongoDB: ${bookingId}`);

            await this.sagaCoordinator.incrementStepCounter(bookingId, 'aggregated');
            await this.sagaCoordinator.removeFromPendingQueue(bookingId);
            await this.sagaCoordinator.cleanup(bookingId);
            this.logger.log(`✅ Redis coordination data cleaned up: ${bookingId}`);

            return {
                bookingId,
                travelBookingRequest: sagaState.originalRequest as any,
                flightReservationId,
                hotelReservationId,
                carRentalReservationId,
                status: 'confirmed',
                timestamp: new Date(),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Failed to aggregate results: ${errorMessage}`);

            // MONGODB: Save error state
            await this.sagaStateRepository.setError(bookingId, errorMessage);

            // REDIS: Set error metadata (keep for debugging)
            await this.sagaCoordinator.setSagaMetadata(
                bookingId,
                {
                    error: errorMessage,
                    failedAt: Date.now().toString(),
                    step: 'aggregation',
                },
                7200,
            ); // Keep error metadata for 2 hours

            throw error;
        }
    }

    /**
     * Aggregate results from all reservation steps - Hybrid MongoDB + Redis approach
     *
     * This is called when all confirmations are received from message broker
     *
     * Redis: Try to get cached state first (fast read)
     * MongoDB: Fallback if cache miss + persist final state (durable)
     * Redis: Clean up coordination data after completion
     */
    async aggregateResults_(
        bookingId: string,
        flightResult: IFlightReservationResult,
        hotelResult: HotelReservationResult,
        carResult: IReservationConfirmResult,
    ): Promise<TravelBookingResponseDto> {
        this.logger.log(`Aggregating results for booking: ${bookingId}`);

        try {
            // REDIS: Try to get cached state first (fast read ~1ms)
            let sagaState = await this.sagaCoordinator.getInFlightState(bookingId);

            // MONGODB: Fallback if cache miss (durable read ~5-20ms)
            if (!sagaState) {
                this.logger.debug(`Cache miss - fetching from MongoDB: ${bookingId}`);
                const mongoState = await this.sagaStateRepository.findByBookingId(bookingId);

                if (!mongoState) {
                    throw new Error(`Saga state not found for booking: ${bookingId}`);
                }

                sagaState = mongoState;
            }

            // MONGODB: Persist final state with all reservation IDs
            await this.sagaStateRepository.updateState(bookingId, {
                flightReservationId: flightResult.reservationId,
                hotelReservationId: hotelResult.reservationId,
                carRentalReservationId: carResult.reservationId,
                status: SagaStatus.CONFIRMED,
                completedSteps: ['flight_reserved', 'hotel_reserved', 'car_reserved', 'payment_processed'],
            });

            this.logger.log(`✅ Saga state updated in MongoDB: ${bookingId}`);

            // REDIS: Track final step completion
            await this.sagaCoordinator.incrementStepCounter(bookingId, 'aggregated');

            // REDIS: Remove from pending queue (saga completed successfully)
            await this.sagaCoordinator.removeFromPendingQueue(bookingId);

            // REDIS: Clean up all coordination data (lock, cache, steps, metadata)
            await this.sagaCoordinator.cleanup(bookingId);
            this.logger.log(`✅ Redis coordination data cleaned up: ${bookingId}`);

            const bookingExecutionResult: TravelBookingResponseDto = {
                bookingId,
                travelBookingRequest: sagaState.originalRequest as any,
                flightReservationId: flightResult.reservationId,
                hotelReservationId: hotelResult.reservationId,
                carRentalReservationId: carResult.reservationId,
                status: 'confirmed',
                timestamp: new Date(),
            };

            return bookingExecutionResult;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Failed to aggregate results: ${errorMessage}`);

            // MONGODB: Save error state
            await this.sagaStateRepository.setError(bookingId, errorMessage);

            // REDIS: Set error metadata (keep for debugging)
            await this.sagaCoordinator.setSagaMetadata(
                bookingId,
                {
                    error: errorMessage,
                    failedAt: Date.now().toString(),
                    step: 'aggregation',
                },
                7200,
            ); // Keep error metadata for 2 hours

            throw error;
        }
    }

    /**
     * Step 1: Reserve Flight
     */
    private async reserveFlight(dto: BookingRequestDto): Promise<IFlightReservationResult> {
        this.logger.log(`Step 1: Reserving Flight...`);

        const flightDto: FlightReservationDto = {
            userId: dto.userId,
            origin: dto.flightOrigin,
            destination: dto.flightDestination,
            departureDate: dto.departureDate,
            returnDate: dto.returnDate,
            amount: dto.totalAmount * 0.4, // 40% of total
        };

        return await this.flightService.makeReservation(flightDto);
    }

    /**
     * Step 2: Reserve Hotel
     */
    private async reserveHotel(dto: BookingRequestDto): Promise<HotelReservationResult> {
        this.logger.log(`Step 2: Reserving Hotel...`);

        const hotelDto: HotelReservationDto = {
            userId: dto.userId,
            hotelId: dto.hotelId,
            checkInDate: dto.checkInDate,
            checkOutDate: dto.checkOutDate,
            amount: dto.totalAmount * 0.35, // 35% of total
        };

        return await this.hotelService.makeReservation(hotelDto);
    }

    /**
     * Step 3: Reserve Car
     */
    private async reserveCar(dto: BookingRequestDto): Promise<IReservationConfirmResult> {
        this.logger.log(`Step 3: Reserving Car...`);

        const carDto: CarRentalReservationDto = {
            userId: dto.userId,
            pickupLocation: dto.carPickupLocation,
            dropoffLocation: dto.carDropoffLocation,
            pickupDate: dto.carPickupDate,
            dropoffDate: dto.carDropoffDate,
            amount: dto.totalAmount * 0.25, // 25% of total
        };

        return await this.carRentalService.makeReservation(carDto);
    }

    /**
     * Step 4: Process Payment (simulated)
     */
    private async processPayment(userId: string, amount: number): Promise<void> {
        this.logger.log(`Step 4: Processing Payment of $${amount}...`);

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate occasional payment failures
        if (Math.random() < 0.05) {
            throw new Error('Payment processing failed');
        }
    }

    /**
     * Compensate - Execute compensating transactions in reverse order
     * This is the heart of the Saga pattern
     *
     * If any compensation fails, publishes CompensationFailedEvent to Dead Letter Queue
     */
    private async compensate(
        bookingId: string,
        flightReservation: IFlightReservationResult | null,
        hotelReservation: HotelReservationResult | null,
        carRentalReservation: IReservationConfirmResult | null,
    ): Promise<void> {
        const compensations: Array<() => Promise<void>> = [];

        // Build compensation stack in reverse order
        if (carRentalReservation) {
            compensations.push(async () => {
                try {
                    await this.carRentalService.cancelReservation(carRentalReservation.reservationId);
                    this.logger.log(`✓ Compensated: Car rental cancelled`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    this.logger.error(`Failed to cancel car rental: ${errorMessage}`);

                    // Publish to Dead Letter Queue
                    const deadLetterEvent = new CompensationFailedEvent(
                        bookingId,
                        'car',
                        carRentalReservation.reservationId,
                        errorMessage,
                        errorStack,
                    );
                    this.eventBus.publish(deadLetterEvent);
                    this.logger.warn(
                        `📮 Published CompensationFailedEvent to Dead Letter Queue for car rental ${carRentalReservation.reservationId}`,
                    );
                }
            });
        }

        if (hotelReservation) {
            compensations.push(async () => {
                try {
                    await this.hotelService.cancelReservation(hotelReservation.reservationId);
                    this.logger.log(`✓ Compensated: Hotel booking cancelled`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    this.logger.error(`Failed to cancel hotel: ${errorMessage}`);

                    // Publish to Dead Letter Queue
                    const deadLetterEvent = new CompensationFailedEvent(
                        bookingId,
                        'hotel',
                        hotelReservation.reservationId,
                        errorMessage,
                        errorStack,
                    );
                    this.eventBus.publish(deadLetterEvent);
                    this.logger.warn(
                        `📮 Published CompensationFailedEvent to Dead Letter Queue for hotel ${hotelReservation.reservationId}`,
                    );
                }
            });
        }

        if (flightReservation) {
            compensations.push(async () => {
                try {
                    await this.flightService.cancelReservation(flightReservation.reservationId);
                    this.logger.log(`✓ Compensated: Flight booking cancelled`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    this.logger.error(`Failed to cancel flight: ${errorMessage}`);

                    // Publish to Dead Letter Queue
                    const deadLetterEvent = new CompensationFailedEvent(
                        bookingId,
                        'flight',
                        flightReservation.reservationId,
                        errorMessage,
                        errorStack,
                    );
                    this.eventBus.publish(deadLetterEvent);
                    this.logger.warn(
                        `📮 Published CompensationFailedEvent to Dead Letter Queue for flight ${flightReservation.reservationId}`,
                    );
                }
            });
        }

        // Execute compensations
        for (const compensate of compensations) {
            await compensate();
        }

        this.logger.log(`✅ Compensation Process Completed`);
    }

    private generateBookingId(): string {
        return `TRV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }

    /**
     * Generate an idempotency key for the given booking request.
     *
     * @param request - The booking request data
     * @returns A unique idempotency key string
     *
     * @example
     * this.generateIdempotencyKey(request) // => "IDM-abc123def456"
     */
    private generateIdempotencyKey(request: BookingRequestDto): string {
        // const data = `${request.userId}-${request.departureDate}-${request.hotelId}-${request.totalAmount}`;
        // return `IDM-${Buffer.from(data).toString('base64').substring(0, 16)}`;
        return randomUUID();
    }

    /**
     * Maps SagaStatus enum to string for response
     */
    private mapSagaStatusToString(status: SagaStatus): string {
        switch (status) {
            case SagaStatus.CONFIRMED:
                return 'confirmed';
            case SagaStatus.COMPENSATED:
                return 'compensated';
            case SagaStatus.FAILED:
                return 'failed';
            case SagaStatus.PENDING:
                return 'pending';
            default:
                return 'unknown';
        }
    }
}
