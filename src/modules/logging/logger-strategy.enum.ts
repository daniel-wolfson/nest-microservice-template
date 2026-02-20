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
    /** Write to both console and file */
    COMBINED = 'combined',
}

/** Maps a LoggerStrategy to a human-readable label. */
// export const LOGGER_STRATEGY_LABEL: Record<LoggerStrategy, string> = {
//     [LoggerStrategy.CONSOLE]: 'Console',
//     [LoggerStrategy.FILE]: 'File',
//     [LoggerStrategy.COMBINED]: 'Console + File',
// };
