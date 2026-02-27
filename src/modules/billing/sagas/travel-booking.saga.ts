import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { FlightService } from '../services/flight.service';
import { HotelService } from '../services/hotel.service';
import { CarRentalService } from '../services/car-rental.service';
import { BookingData as BookingRequestDto, TravelBookingResponseDto } from '../dto/booking-data.dto';
import { FlightReservationRequest as FlightReservationRequest } from '../dto/flight-reservation-request.dto';
import { HotelReservationResult } from '../dto/hotel-reservation-result.dto';
import { CarReservationRequest } from '../dto/car-rental-reservation.dto';
import { CompensationFailedEvent } from '../events/impl/compensation-failed.event';
import { BILLING_BROKER_CLIENT } from '../brokers/billing-broker.constants';
import { BillingBrokerClient } from '../brokers/billing-broker-client.interface';
import { randomUUID, UUID } from 'crypto';
import {
    TravelBookingSagaStateRepository,
    TravelBookingSagaStateRepository as TravelBookingStateService,
} from './travel-booking-saga-state.repository';
import { SagaCoordinator } from './saga-coordinator.service';
import { ReservationStatus } from './saga-status.enum';
import { TravelBookingExecutionResult } from './travel-booking-execute-result';
import { validate } from 'class-validator';
import { ReservationResult } from '../dto/reservation-confirm-result.dto';
import { TravelBookingSagaState, TravelBookingSagaStateDocument } from './travel-booking-saga-state.schema';
import { DefaultSchemaOptions, Document, Model, Types } from 'mongoose';
import { HotelReservationRequest } from '../dto/hotel-reservation.-request.dto';
import { EventType as EventType, ReservationType } from './reservation-types.enum';
import { TravelBookingSagaRedisState } from './travel-booking-saga-state.type';

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
 * - in-active caching: Fast state access during saga execution
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

    /** === SAGA COORDINATION (Redis) ===
     * - Purpose: Lock key, prevents duplicate saga execution
     * - Scope: ONE per saga execution
     * - Used in: Redis locks, cache, pending queue
     */
    requestId: string;

    /** === BUSINESS PACKAGE (MongoDB) ===
     * - Purpose: Customer-facing confirmation number
     * - Scope: ONE per successful saga (contains all 3 bookings)
     * - Used in: Email confirmation, customer lookup
     */
    bookingId: string;

    /** EXTERNAL SERVICE IDs (MongoDB) ===
     * - Purpose: Individual booking IDs from external systems
     * - Scope: THREE different IDs (one per service)
     * - Used in: Cancellations, modifications, check-in
     */
    flightReservationId: string;
    hotelReservationId: string;
    carReservationId: string;

    constructor(
        private readonly flightService: FlightService,
        private readonly hotelService: HotelService,
        private readonly carRentalService: CarRentalService,
        private readonly eventBus: EventBus,
        @Inject(BILLING_BROKER_CLIENT)
        private readonly billingBrokerClient: BillingBrokerClient,
        private readonly _sagaDbState: TravelBookingSagaStateRepository,
        private readonly _coordinator: SagaCoordinator,
    ) {}

    /**
     * Expose Redis SagaCoordinator for use in event handlers and other services that need to interact with Redis coordination features.
     */
    public get coordinator(): SagaCoordinator {
        return this._coordinator;
    }

    /**
     * Expose TravelBookingSagaStateRepository for use in event handlers and other services that need to interact with MongoDB persistence features.
     */
    public get dbState(): TravelBookingSagaStateRepository {
        return this._sagaDbState;
    }

    /**
     * Execute the travel booking saga - Hybrid MongoDB + Redis approach
     *
     * Redis: Distributed lock, rate limiting, in-active cache, pending queue
     * MongoDB: Persistent state for audit trail and recovery
     *
     * Returns a response with the booking status and details
     */
    async execute(request: BookingRequestDto): Promise<TravelBookingExecutionResult> {
        // saga-execute-step 1: Generate idempotency key for duplicate detection
        const validationErrors = await validate(request);
        if (validationErrors.length > 0) {
            const errorMessages = validationErrors.map(err => Object.values(err.constraints || {})).flat();
            throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
        }

        this.requestId = request.requestId || this.generateIdempotencyKey(request);
        this.logger.log(`Processing travel booking with idempotency key: ${this.requestId}`);
        this.logger.log(`User: ${request.userId}, Total Amount: $${request.totalAmount}`);

        let lockAcquired = false;
        let bookingExecutionResult: TravelBookingExecutionResult = {
            requestId: this.requestId,
            bookingId: null,
            originalRequest: request,
            timestamp: new Date().toISOString(),
            status: null,
            message: null,
        };

        try {
            // saga-execute-step 2: MONGODB - Check if saga already exists (completed or in-progress)
            const existingSaga = await this._sagaDbState.findByRequestId(this.requestId);
            if (existingSaga) {
                this.logger.log(`✅ Duplicate request detected, returning existing saga: ${existingSaga.bookingId}`);
                return {
                    requestId: existingSaga.requestId,
                    bookingId: existingSaga.bookingId,
                    timestamp: existingSaga.timestamp,
                    originalRequest: request as any,
                    status: existingSaga.status,
                    message: existingSaga.errorMessage || null,
                };
            }

            // saga-execute-step 3: REDIS - Check if saga is currently in-active (race condition protection)
            const activeSagaState = await this.coordinator.getActiveSagaState(this.requestId);
            if (activeSagaState) {
                this.logger.log(`⚠️ Saga already in-active in Redis: ${this.requestId}`);
                return {
                    requestId: this.requestId,
                    bookingId: activeSagaState.bookingId || null,
                    originalRequest: activeSagaState.metadata || request,
                    timestamp: activeSagaState.timestamp || new Date().toISOString(),
                    status: activeSagaState.status || ReservationStatus.PENDING,
                    message:
                        activeSagaState.message ||
                        `Saga already in progress for ${this.requestId}, please wait for completion or check later`,
                };
            }

            // saga-execute-step 4: Acquire distributed lock using idempotency key (prevent duplicate saga execution)
            lockAcquired = await this.coordinator.acquireSagaLock(this.requestId, 300);
            if (!lockAcquired) {
                const errorMsg = `Saga already in progress for request: ${this.requestId}`;
                this.logger.warn(`⚠️ ${errorMsg}`);
                bookingExecutionResult.status = ReservationStatus.FAILED;
                bookingExecutionResult.message = errorMsg;
                return bookingExecutionResult;
            }

            // saga-execute-step 5: Check rate limit (prevent spam bookings)
            const canProceed = await this.coordinator.checkRateLimit(request.userId, 5);
            if (!canProceed) {
                throw new Error(`Rate limit exceeded for user: ${request.userId}`);
            }

            // ⚠️ bookingId NOT generated here — generated ONLY in aggregateResults() after JOIN POINT
            // this.bookingId is undefined at this stage (customer confirmation number created later)

            // saga-execute-step 6: MONGODB: Save persistent state for audit and recovery
            await this._sagaDbState.create({
                requestId: this.requestId,
                userId: request.userId,
                status: ReservationStatus.PENDING,
                originalRequest: request as any,
                totalAmount: request.totalAmount,
                timestamp: new Date().toISOString(),
                completedSteps: [],
            });
            this.logger.log(`✅ Saga state saved to MongoDB with requestId: ${this.requestId}`);

            // saga-execute-step 7: REDIS. Cache in-active state for fast reads (keyed by idempotencyKey)
            await this.coordinator.setActiveSagaState(
                this.requestId,
                {
                    bookingId: null, // ✅ Will be set later in aggregateResults()
                    requestId: this.requestId,
                    userId: request.userId,
                    status: ReservationStatus.PENDING,
                    timestamp: new Date().toISOString(),
                    totalAmount: request.totalAmount,
                    metadata: request,
                },
                3600,
            );

            // saga-execute-step 8: Add to pending queue for monitoring
            await this.coordinator.addToPendingQueue(this.requestId);

            // saga-execute-step 9: publish hotel reservation request
            await this.billingBrokerClient.emit(EventType.HOTEL_REQUESTED, this.reserveHotel(request));
            this.logger.log(`✅ reservation.hotel.requested event published: ${this.requestId}`);
            await this.coordinator.incrementStepCounter(this.requestId, 'HOTEL_REQUESTED');

            // saga-execute-step 10: publish flight reservation request
            await this.billingBrokerClient.emit(EventType.FLIGHT_REQUESTED, this.reserveFlight(request));
            this.logger.log(`✅ reservation.flight.requested event published: ${this.requestId}`);
            await this.coordinator.incrementStepCounter(this.requestId, 'FLIGHT_REQUESTED');

            // saga-execute-step 11: publish car rental reservation request
            await this.billingBrokerClient.emit(EventType.CAR_REQUESTED, this.reserveCar(request));
            this.logger.log(`✅ reservation.car.requested event published: ${this.requestId}`);
            await this.coordinator.incrementStepCounter(this.requestId, 'CAR_REQUESTED');

            bookingExecutionResult.status = ReservationStatus.PENDING;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`❌ Failed to publish travel booking request: ${errorMessage}`, errorStack);

            // saga-execute-step 12: MONGODB: Save error state
            // Always use requestId during execute() phase (bookingId not yet generated)
            await this._sagaDbState.setError(this.requestId, errorMessage, errorStack);

            // saga-execute-step 13: REDIS: Set error metadata for debugging
            const metadataPayload = {
                error: errorMessage,
                failedAt: new Date().toISOString(),
                bookingId: 'not_generated', // bookingId created only in aggregateResults()
            };
            await this.coordinator.setSagaMetadata(this.requestId, metadataPayload);

            bookingExecutionResult.status = ReservationStatus.FAILED;
            bookingExecutionResult.message = errorMessage;
        } finally {
            // saga-execute-step 14: REDIS: Release distributed lock (using idempotencyKey)
            if (lockAcquired) {
                await this.coordinator.releaseSagaLock(this.requestId);
            }
            // saga-execute-step 15: REDIS: Clear in-active cache on completion or error
            await this.coordinator.clearActiveSagaState(this.requestId);
        }
        return bookingExecutionResult;
    }

    async execute_old(dto: BookingRequestDto): Promise<TravelBookingResponseDto> {
        const bookingId = this.generateBookingId();
        let flightReservation: ReservationResult | null = null;
        let hotelReservation: HotelReservationResult | null = null;
        let carRentalReservation: ReservationResult | null = null;

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
                requestId: dto,
                flightReservationId: flightReservation.reservationId,
                hotelReservationId: hotelReservation.reservationId,
                carRentalReservationId: carRentalReservation.reservationId,
                status: ReservationStatus.CONFIRMED,
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
                requestId: dto,
                flightReservationId: flightReservation?.reservationId || null,
                hotelReservationId: hotelReservation?.reservationId || null,
                carRentalReservationId: carRentalReservation?.reservationId || null,
                status: ReservationStatus.COMPENSATING,
                errorMessage,
                timestamp: new Date(),
            };
        }
    }

    async aggregateResults(requestId: string): Promise<TravelBookingResponseDto> {
        this.logger.log(`Aggregating results for booking: ${requestId}`);
        try {
            // MONGODB: Read state — reservation IDs already saved by event handlers
            // Use findByRequestId because bookingId is not yet generated at this stage
            const sagaState = await this._sagaDbState.findByRequestId(requestId);

            if (!sagaState) {
                throw new Error(`Saga state not found for booking: ${requestId}`);
            }

            const { flightReservationId, hotelReservationId, carRentalReservationId } = sagaState;

            if (!flightReservationId || !hotelReservationId || !carRentalReservationId) {
                throw new Error(
                    `Incomplete reservation IDs for booking ${requestId}: ` +
                        `flight=${flightReservationId}, hotel=${hotelReservationId}, car=${carRentalReservationId}`,
                );
            }

            // Generate bookingId ONLY when all 3 reservations are confirmed (JOIN POINT reached)
            const bookingId = this.generateBookingId();
            this.logger.log(`✅ Generated final bookingId: ${bookingId} for request: ${requestId}`);

            // MongoDB: Save bookingId and finalize status in one atomic update
            await this._sagaDbState.updateState(requestId, {
                bookingId,
                status: ReservationStatus.CONFIRMED,
                completedSteps: ['FLIGHT_CONFIRMED', 'HOTEL_CONFIRMED', 'CAR_CONFIRMED', 'COMPLETED'],
            });

            // REDIS: Cleanup coordination data
            await this.coordinator.incrementStepCounter(requestId, 'COMPLETED');
            await this.coordinator.removeFromPendingQueue(requestId);
            await this.coordinator.cleanup(requestId);
            this.logger.log(`Redis coordination data cleaned up: ${requestId}`);

            // Return the generated bookingId (customer confirmation number)
            return {
                bookingId,
                requestId: sagaState.requestId as any,
                flightReservationId,
                hotelReservationId,
                carRentalReservationId,
                status: ReservationStatus.CONFIRMED,
                timestamp: new Date(),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Failed to aggregate results: ${errorMessage}`);

            // MONGODB: Save error state
            await this._sagaDbState.setError(requestId, errorMessage);

            // REDIS: Set error metadata (keep for debugging)
            await this.coordinator.setSagaMetadata(
                requestId,
                {
                    error: errorMessage,
                    failedAt: new Date().toISOString(),
                    step: 'aggregation',
                },
                7200,
            ); // Keep error metadata for 2 hours

            throw error;
        }
    }

    async findByBookingId(bookingId: string): Promise<TravelBookingSagaStateDocument | null> {
        return await this._sagaDbState.findByBookingId(bookingId);
    }
    async deleteByUserId(userId: string): Promise<void> {
        await this._sagaDbState.deleteByUserId(userId);
    }
    async findByRequestId(requestId: string): Promise<TravelBookingSagaStateDocument> {
        const savedState = await this._sagaDbState.findByRequestId(requestId);
        return savedState;
    }

    async saveConfirmedReservation(
        type: ReservationType,
        requestId: string,
        reservationId: string,
        step: string,
    ): Promise<TravelBookingSagaStateDocument | null> {
        return await this._sagaDbState.saveConfirmedReservation(type, requestId, reservationId, step);
    }

    /**
     * Step 1: Reserve Flight
     */
    private async reserveFlight(dto: BookingRequestDto): Promise<ReservationResult> {
        this.logger.log(`Step 1: Reserving Flight...`);

        const flightDto: FlightReservationRequest = {
            requestId: this.requestId,
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

        const hotelDto: HotelReservationRequest = {
            requestId: this.requestId,
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
    private async reserveCar(dto: BookingRequestDto): Promise<ReservationResult> {
        this.logger.log(`Step 3: Reserving Car...`);

        const carDto: CarReservationRequest = {
            requestId: this.requestId,
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
        flightReservation: ReservationResult | null,
        hotelReservation: HotelReservationResult | null,
        carRentalReservation: ReservationResult | null,
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

    /**
     * Generate a unique booking ID.
     * @returns A unique booking ID string
     * @example this.generateBookingId() => "TRV-1627890123456-ABC123DEF"
     */
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
    private mapSagaStatusToString(status: ReservationStatus): string {
        switch (status) {
            case ReservationStatus.PENDING:
                return 'PENDING';
            case ReservationStatus.CONFIRMED:
                return 'CONFIRMED';
            case ReservationStatus.COMPENSATING:
                return 'COMPENSATING';
            case ReservationStatus.FAILED:
                return 'FAILED';
            default:
                return 'unknown';
        }
    }
}
