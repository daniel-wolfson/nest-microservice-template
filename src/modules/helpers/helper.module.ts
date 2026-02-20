import { Module } from '@nestjs/common';
import { ApiHelper } from './helper.service';

/**
 * HelperModule
 *
 * Provides common utility services for ID generation, confirmation codes,
 * and delay simulation. Import this module in any feature module that needs
 * these utilities.
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [HelperModule],
 *   providers: [FlightService],
 * })
 * export class BillingModule {}
 * ```
 */
@Module({
    providers: [ApiHelper],
    exports: [ApiHelper],
})
export class HelperModule {}
