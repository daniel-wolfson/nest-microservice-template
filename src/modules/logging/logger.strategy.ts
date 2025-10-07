import { LoggerStrategy } from './logger-strategy.enum';

/** Default logging strategy when none is specified */
export const DEFAULT_STRATEGY = LoggerStrategy.WINSTON;

/**
 * Strategy alias map - defined once, reused across calls
 * Maps user-friendly aliases to LoggerStrategy enum values
 */
const STRATEGY_MAP: Readonly<Record<string, LoggerStrategy>> = {
    console: LoggerStrategy.CONSOLE,
    file: LoggerStrategy.FILE,
    winston: LoggerStrategy.WINSTON,
    elasticsearch: LoggerStrategy.ELASTICSEARCH,
    els: LoggerStrategy.ELASTICSEARCH,
    all: LoggerStrategy.ALL,
    default: LoggerStrategy.ALL,
    syslog: LoggerStrategy.SYSLOG,
} as const;

/** Cached set of valid strategy values for O(1) lookup */
const VALID_STRATEGIES = new Set<string>(Object.values(LoggerStrategy));

/**
 * Converts environment variable LOG_STRATEGY to LoggerStrategy enum
 * @param envStrategy - The LOG_STRATEGY environment variable value
 * @returns LoggerStrategy enum value
 */
export const getLoggerStrategy = (envStrategy?: string): LoggerStrategy => {
    if (!envStrategy) {
        return DEFAULT_STRATEGY;
    }

    const normalized = envStrategy.toLowerCase().trim();
    return STRATEGY_MAP[normalized] ?? DEFAULT_STRATEGY;
};

/**
 * Validates if a string is a valid LoggerStrategy value
 * @param strategy - String to validate
 * @returns boolean indicating if the strategy is valid
 */
export const isValidLoggerStrategy = (strategy: string): strategy is LoggerStrategy => {
    return VALID_STRATEGIES.has(strategy);
};

/**
 * Gets all available logger strategies
 * @returns Array of all LoggerStrategy values
 */
export const getAllLoggerStrategies = (): readonly LoggerStrategy[] => {
    return Object.values(LoggerStrategy);
};

/**
 * Gets all supported strategy aliases (for documentation/help text)
 * @returns Array of all supported input strings
 */
export const getStrategyAliases = (): readonly string[] => {
    return Object.keys(STRATEGY_MAP);
};
