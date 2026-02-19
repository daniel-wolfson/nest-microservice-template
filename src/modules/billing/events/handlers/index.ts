import { SubscriptionCreatedHandler } from './subscription-created.handler';
import { SubscriptionCanceledHandler } from './subscription-canceled.handler';
import { PaymentSuccessHandler } from './payment-success.handler';
import { UserBalanceLowHandler } from './user-balance-low.handler';
import { OrderCreatedHandler } from './order-created.handler';
import { CompensationFailedHandler } from './compensation-failed.handler';
import { TravelBookingFlightReservationHandler } from './travel-booking-flight-reservation.handler';
import { TravelBookingHotelReservationHandler } from './travel-booking-hotel-reservation.handler';
import { TravelBookingCarRentalReservationHandler } from './travel-booking-car-rental-reservation.handler';

export const EventHandlers = [
    SubscriptionCreatedHandler,
    SubscriptionCanceledHandler,
    PaymentSuccessHandler,
    UserBalanceLowHandler,
    OrderCreatedHandler,
    CompensationFailedHandler,
    TravelBookingFlightReservationHandler,
    TravelBookingHotelReservationHandler,
    TravelBookingCarRentalReservationHandler,
];
