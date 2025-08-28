/**
 * Logger Strategy Enum
 * Defines available logging strategies for the application
 */
export enum LoggerStrategy {
    CONSOLE = 'console',
    FILE = 'file',
    WINSTON = 'winston',
    ELASTICSEARCH = 'elasticsearch',
    ALL = 'all',
    SYSLOG = 'syslog',
}

/**
 * Converts environment variable LOG_STRATEGY to LoggerStrategy enum
 * @param envStrategy - The LOG_STRATEGY environment variable value
 * @returns LoggerStrategy enum value
 */
export const getLoggerStrategy = (envStrategy?: string): LoggerStrategy => {
    if (!envStrategy) {
        return LoggerStrategy.WINSTON; // Default strategy
    }

    const normalizedStrategy = envStrategy.toLowerCase().trim();

    // Map common aliases to enum values
    const strategyMap: Record<string, LoggerStrategy> = {
        console: LoggerStrategy.CONSOLE,
        file: LoggerStrategy.FILE,
        winston: LoggerStrategy.WINSTON,
        elasticsearch: LoggerStrategy.ELASTICSEARCH,
        els: LoggerStrategy.ELASTICSEARCH, // Alias for elasticsearch
        all: LoggerStrategy.ALL,
        default: LoggerStrategy.ALL, // Alias for all
        syslog: LoggerStrategy.SYSLOG,
    };

    return strategyMap[normalizedStrategy] || LoggerStrategy.WINSTON;
};

/**
 * Validates if a string is a valid LoggerStrategy
 * @param strategy - String to validate
 * @returns boolean indicating if the strategy is valid
 */
export const isValidLoggerStrategy = (strategy: string): strategy is keyof typeof LoggerStrategy => {
    return Object.values(LoggerStrategy).includes(strategy as LoggerStrategy);
};

/**
 * Gets all available logger strategies
 * @returns Array of all LoggerStrategy values
 */
export const getAllLoggerStrategies = (): LoggerStrategy[] => {
    return Object.values(LoggerStrategy);
};
