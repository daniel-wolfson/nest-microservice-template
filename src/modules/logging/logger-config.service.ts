import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModuleOptionsFactory, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import * as os from 'os';
import { LoggerStrategy, getLoggerStrategy } from './logger-strategy.enum';

export type LogStrategy = 'CONSOLE' | 'FILE' | 'ELASTICSEARCH' | 'ELS' | 'SYSLOG' | 'DEFAULT';

@Injectable()
export class LoggerConfigService implements WinstonModuleOptionsFactory {
    constructor(private readonly configService: ConfigService) {}

    /**
     * Creates and configures the Winston logger module options based on the current environment,
     * platform, and logging strategy. This method determines the appropriate log level, transports,
     * and default metadata for the logger, and returns a configuration object compatible with
     * the WinstonModule.
     * @returns {WinstonModuleOptions} The configured Winston module options.
     */
    createWinstonModuleOptions(): WinstonModuleOptions {
        const environment = this.getEnvironment();
        const isProduction = environment === 'production';
        const platform = this.getPlatform();
        const logStrategy = this.getLogStrategy();
        const logLevel = this.getLogLevel(isProduction);

        const transports = this.createTransports({
            environment,
            isProduction,
            platform,
            logStrategy,
            logLevel,
        });

        return {
            level: logLevel,
            transports,
            exitOnError: false,
            defaultMeta: this.createDefaultMeta(environment, platform),
        };
    }

    /**
     * Retrieves the current application environment from the configuration service.
     * If the 'NODE_ENV' variable is not set, defaults to 'development'.
     * @returns {string} The current environment (e.g., 'development', 'production', etc.).
     */
    private getEnvironment(): string {
        return this.configService.get<string>('NODE_ENV') || 'development';
    }

    /**
     * Retrieves the current operating system platform identifier.
     * @returns {NodeJS.Platform} The platform identifier string (e.g., 'win32', 'linux', 'darwin').
     */
    private getPlatform(): NodeJS.Platform {
        return os.platform();
    }

    /**
     * Retrieves the current log strategy from the configuration service.
     * If the 'LOG_STRATEGY' environment variable is not set, defaults to 'CONSOLE'.
     * The returned value is converted to uppercase and cast to the `LogStrategy` type.
     * @returns {LogStrategy} The log strategy (e.g 'CONSOLE' | 'FILE' | 'ELASTICSEARCH' | 'SYSLOG' | 'ALL').
     */
    private getLogStrategy(): LoggerStrategy {
        return getLoggerStrategy(this.configService.get<string>('LOG_STRATEGY'));
    }

    private getLogLevel(isProduction: boolean): string {
        return this.configService.get<string>('LOG_LEVEL') || (isProduction ? 'info' : 'debug');
    }

    private createDefaultMeta(environment: string, platform: NodeJS.Platform) {
        return {
            service: 'microservice-template',
            environment,
            platform,
            hostname: os.hostname(),
            pid: process.pid,
        };
    }

    private createTransports(config: {
        environment: string;
        isProduction: boolean;
        platform: NodeJS.Platform;
        logStrategy: LoggerStrategy;
        logLevel: string;
    }): winston.transport[] {
        const transports: winston.transport[] = [];

        switch (config.logStrategy) {
            case LoggerStrategy.ELASTICSEARCH:
                this.addElasticsearchTransport(transports, config);
                break;
            case LoggerStrategy.FILE:
                this.addFileTransports(transports, config);
                break;
            case LoggerStrategy.SYSLOG:
                if (config.platform === 'linux' && config.isProduction) {
                    this.addSyslogTransport(transports);
                }
                break;
            case LoggerStrategy.CONSOLE:
                this.addConsoleTransport(transports, config);
                break;
            case LoggerStrategy.WINSTON:
                this.addConsoleTransport(transports, config);
                break;
            case LoggerStrategy.ALL:
            default:
                this.addElasticsearchTransport(transports, config);
                this.addFileTransports(transports, config);
                this.addConsoleTransport(transports, config);
                if (config.platform === 'linux' && config.isProduction) {
                    this.addSyslogTransport(transports);
                }
                break;
        }

        return transports;
    }

    private addElasticsearchTransport(
        transports: winston.transport[],
        config: { environment: string; isProduction: boolean },
    ): void {
        const elasticsearchNode = this.configService.get<string>('ELASTICSEARCH_NODE');
        if (!elasticsearchNode) return;

        try {
            transports.push(
                new ElasticsearchTransport({
                    level: config.isProduction ? 'info' : 'debug',
                    clientOpts: {
                        node: elasticsearchNode,
                        maxRetries: 3,
                        requestTimeout: 10000,
                        sniffOnStart: false,
                    },
                    index: `microservice-logs-${config.environment}`,
                    indexPrefix: 'microservice',
                    indexSuffixPattern: 'YYYY.MM.DD',
                    transformer: (logData: any) => ({
                        '@timestamp': new Date().toISOString(),
                        level: logData.level,
                        message: logData.message,
                        environment: config.environment,
                        platform: os.platform(),
                        hostname: os.hostname(),
                        service: 'microservice-template',
                        ...logData.meta,
                    }),
                }),
            );
        } catch (error) {
            console.warn('Failed to configure Elasticsearch transport:', error);
        }
    }

    private addFileTransports(
        transports: winston.transport[],
        config: { platform: NodeJS.Platform; logLevel: string; isProduction: boolean },
    ): void {
        const logDir = config.platform === 'linux' ? '/var/log/microservice' : 'logs';
        const fileTransportOptions = {
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
            ),
        };

        transports.push(
            new DailyRotateFile({
                ...fileTransportOptions,
                level: config.logLevel,
                filename: `${logDir}/application-%DATE%.log`,
                maxFiles: config.isProduction ? '30d' : '7d',
                createSymlink: config.platform === 'linux',
                symlinkName: config.platform === 'linux' ? `${logDir}/current.log` : undefined,
            }),
            new DailyRotateFile({
                ...fileTransportOptions,
                level: 'error',
                filename: `${logDir}/error-%DATE%.log`,
                maxFiles: config.isProduction ? '90d' : '14d',
                createSymlink: config.platform === 'linux',
                symlinkName: config.platform === 'linux' ? `${logDir}/current-error.log` : undefined,
            }),
        );
    }

    private addConsoleTransport(
        transports: winston.transport[],
        config: { logLevel: string; isProduction: boolean },
    ): void {
        const format = config.isProduction
            ? winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.json(),
              )
            : winston.format.combine(
                  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                  winston.format.errors({ stack: true }),
                  winston.format.colorize(),
                  winston.format.printf(({ timestamp, level, message, ...meta }) => {
                      const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
                      return `${timestamp} [${level}]: ${message}${metaStr}`;
                  }),
              );

        transports.push(
            new winston.transports.Console({
                level: config.logLevel,
                format,
                handleExceptions: true,
                handleRejections: true,
            }),
        );
    }

    private addSyslogTransport(transports: winston.transport[]): void {
        try {
            const SyslogTransport = require('winston-syslog').Syslog;
            transports.push(
                new SyslogTransport({
                    level: 'info',
                    host: 'localhost',
                    port: 514,
                    protocol: 'unix',
                    path: '/dev/log',
                    facility: 'local0',
                    app_name: 'microservice-template',
                    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                }),
            );
        } catch (error) {
            console.warn('Syslog transport not available:', error);
        }
    }
}
