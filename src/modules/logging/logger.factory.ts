import { Injectable, Logger } from '@nestjs/common';
import * as winston from 'winston';
import { LoggerStrategy } from './logger-strategy.enum';
import { getLoggerStrategy } from './logger.strategy';
import { StructuredLogger } from '../../common/winston.logger';
import { ElasticsearchLoggerService } from '../elasticsearch/elasticsearch-logger.service';
import { ConfigService } from '@nestjs/config';
import { EnvironmentConfigFactory } from 'src/config/environment.config';

// Define as const array first (single source of truth)
const ALLOWED_LOG_LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];

// Derive the type from the array
type LevelType = typeof ALLOWED_LOG_LEVELS[number];

/**
 * Injection token used to retrieve a context-scoped Logger from the DI container.
 *
 * Usage:
 * ```ts
 * constructor(@Inject(LOGGER) private readonly logger: Logger) {}
 * ```
 */
export const LOGGER = 'LOGGER';

@Injectable()
export class LoggerFactory {
    /**
     * Gets the log levels based on the environment configuration
     * @param configService - ConfigService instance to access environment variables
     * @returns Array of log levels
     */
    static getLogLevels(configService: ConfigService<unknown, boolean>): LevelType[] {
        // Configure log levels based on environment

        const logLevels = EnvironmentConfigFactory.getLogLevel(configService).filter(
            (level: unknown): level is typeof ALLOWED_LOG_LEVELS[number] =>
                typeof level === 'string' && ALLOWED_LOG_LEVELS.includes(level as any),
        );
        return logLevels.length > 0 ? logLevels : ALLOWED_LOG_LEVELS;
    }
    /**
     * Creates a Winston logger instance with specific log levels
     * @param logLevels - Array of log levels to enable
     * @returns Winston logger instance
     */
    static createWinstonInstance(logLevels: LevelType[] = ALLOWED_LOG_LEVELS): winston.Logger {
        // Map NestJS log levels to Winston levels
        const levelMap: Record<string, string> = {
            verbose: 'silly',
            debug: 'debug',
            log: 'info',
            warn: 'warn',
            error: 'error',
            fatal: 'error',
        };

        // Determine the minimum log level
        const winstonLevels = logLevels.map(level => levelMap[level] || level);
        const minLevel = winstonLevels.includes('silly')
            ? 'silly'
            : winstonLevels.includes('debug')
            ? 'debug'
            : winstonLevels.includes('info')
            ? 'info'
            : winstonLevels.includes('warn')
            ? 'warn'
            : 'error';

        return winston.createLogger({
            level: minLevel,
            levels: winston.config.npm.levels,
            transports: [
                new winston.transports.Console({
                    level: minLevel,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.colorize(),
                        winston.format.simple(),
                    ),
                }),
            ],
        });
    }

    /**
     * Creates a logger instance based on the strategy
     * @param strategy - Logger strategy to use
     * @param app - NestJS application instance (needed for Elasticsearch client)
     * @returns Logger instance
     */
    static createLogger(strategy?: LoggerStrategy, app?: any): any {
        const loggerStrategy = strategy || getLoggerStrategy(process.env.LOG_STRATEGY);

        // Get log levels if app is available, otherwise use defaults
        let logLevels: LevelType[] = ALLOWED_LOG_LEVELS;
        if (app) {
            try {
                const configService = app.get(ConfigService);
                logLevels = LoggerFactory.getLogLevels(configService);
            } catch (error) {
                throw new Error('ConfigService is not available in the application context');
            }
        }

        // Create Winston instance with configured log levels
        const loggerInstance = LoggerFactory.createWinstonInstance(logLevels);

        try {
            switch (loggerStrategy) {
                case LoggerStrategy.ELASTICSEARCH:
                    if (!app) {
                        throw new Error('Application instance required for Elasticsearch logger');
                    }
                    const esClient = app.get('ELASTICSEARCH_CLIENT', { strict: false });
                    if (!esClient) {
                        throw new Error('ELASTICSEARCH_CLIENT provider not found');
                    }
                    return new ElasticsearchLoggerService(esClient);

                case LoggerStrategy.WINSTON:
                case LoggerStrategy.CONSOLE:
                case LoggerStrategy.FILE:
                case LoggerStrategy.ALL:
                case LoggerStrategy.SYSLOG:
                default:
                    return new StructuredLogger(loggerInstance);
            }
        } catch (error: unknown) {
            const fallbackLogger = new StructuredLogger(loggerInstance);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            fallbackLogger.warn(
                `Failed to initialize ${loggerStrategy} logger: ${errorMessage}. Using Winston fallback.`,
            );
            return fallbackLogger;
        }
    }

    /**
     * Creates a logger from environment variables
     * @param app - NestJS application instance
     * @returns Logger instance
     */
    static createFromEnvironment(app?: any): any {
        const strategy = getLoggerStrategy(process.env.LOG_STRATEGY);
        return this.createLogger(strategy, app);
    }

    /**
     * Gets the current logger strategy from environment
     * @returns Current LoggerStrategy
     */
    static getCurrentStrategy(): LoggerStrategy {
        return getLoggerStrategy(process.env.LOG_STRATEGY);
    }
}

/**
 * Creates a NestJS Logger pre-configured with the given context string.
 *
 * Usage in a dynamic provider:
 * ```ts
 * { provide: LOGGER, useFactory: loggerFactory('WebhookController') }
 * ```
 */
export const loggerFactory = (context: string) => () => new Logger(context);
