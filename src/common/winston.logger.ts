import { Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

export class StructuredLogger implements LoggerService {
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

    log(message: string, ...meta: any[]) {
        this.logger.info(message, meta);
    }

    info(message: string, ...meta: any[]) {
        this.logger.info(message, meta);
    }

    error(message: string, ...meta: any[]) {
        this.logger.error(message, meta);
    }

    warn(message: string, ...meta: any[]) {
        this.logger.warn(message, meta);
    }

    debug(message: string, ...meta: any[]) {
        this.logger.debug(message, meta);
    }

    verbose(message: string, ...meta: any[]) {
        this.logger.verbose(message, meta);
    }
}
