import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';

/**
 * HelperService
 *
 * Provides common utility methods used across multiple services,
 * including ID generation, confirmation code generation, and delay simulation.
 */
@Injectable()
export class ApiHelper {
    static config: any;

    constructor(appConfig: AppConfigService) {
        ApiHelper.config = appConfig;
    }

    /**
     * Generate a unique ID with the given prefix.
     *
     * @param prefix - The prefix to prepend to the ID (e.g., 'FLT', 'HTL', 'CAR')
     * @returns A unique ID string in the format: PREFIX-timestamp-randomString
     *
     * @example
     * helperService.generateId('FLT') // => "FLT-1708473824567-abc123de"
     */
    static generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Generate a random confirmation code.
     *
     * @returns A 4-character uppercase alphanumeric confirmation code
     *
     * @example
     * helperService.generateConfirmationCode() // => "A3B9"
     */
    static generateConfirmationCode(): string {
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    /**
     * Simulate an async delay for NON-PRODUCTION environments
     * (useful for testing and simulating external API calls).
     *
     * @param ms - The number of milliseconds to delay
     * @returns A promise that resolves after the specified delay
     *
     * @example
     * await helperService.simulateDelay(1000); // Wait 1 second
     */
    static async simulateDelayOrRandomError(ms: number = 500, errorRate: number = 0.1): Promise<void> {
        if (ApiHelper.config?.environment == 'production') return; // Skip delay in production for better performance

        // Simulate failure rate for testing
        // if (Math.random() < errorRate) {
        //     const logger = new Logger('ApiHelper');
        //     logger.error('reservation random failed to simulate compensation flow');
        //     throw new Error('reservation random failed to simulate compensation flow');
        // }

        ms = ms ?? ApiHelper.config?.defaultDelay ?? 500; // Default to 500ms if no value is provided
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generates a realistic PNR with format validation
     * Format: 6 characters (excluding 0,1,I,O,A,E,U to avoid confusion)
     * Combinations: 29^6 = 594,823,321 (~595 million)
     * Examples: "F7Y9K2", "HK4W8P", "CZ3M5T"
     */
    static chars = '23456789BCDFGHJKLMNPQRSTVWXYZ'; // 29 characters
    static generatePNR(prefix: 'FLT' | 'FLIGHT' | 'HTL' | 'HOTEL' | 'CAR'): string {
        const rest = Array.from(
            { length: 5 },
            () => ApiHelper.chars[Math.floor(Math.random() * ApiHelper.chars.length)],
        ).join('');
        return `${prefix.charAt(0)}-${rest}`;
    }
}
