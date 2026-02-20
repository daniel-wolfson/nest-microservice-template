import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { LoggerConfigService } from './logger-config.service';
import { LOGGER, loggerFactory, LoggerFactory } from './logger.factory';

@Module({
    imports: [
        WinstonModule.forRootAsync({
            imports: [ConfigModule],
            useClass: LoggerConfigService,
        }),
    ],
    exports: [WinstonModule],
})
export class LoggerModule {
    /**
     * Returns a DynamicModule that exposes a `Logger` pre-tagged with
     * the supplied `context` string under the `LOGGER` injection token.
     *
     * @example
     * // In BillingModule:
     * LoggerModule.forFeature(WebhookController.name)
     *
     * // Equivalent inline provider:
     * { provide: LOGGER, useValue: new Logger(WebhookController.name) }
     */
    static forFeature(context: string): DynamicModule {
        return {
            module: LoggerModule,
            providers: [
                LoggerConfigService,
                {
                    provide: LOGGER,
                    useFactory: loggerFactory(context),
                },
                // Re-export bare Logger so consumers can use it without the token
                {
                    provide: Logger,
                    useFactory: loggerFactory(context),
                },
            ],
            exports: [LOGGER, Logger, LoggerConfigService],
        };
    }
}
