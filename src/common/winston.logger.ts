import { LoggerService } from '@nestjs/common';
import { Logger } from 'winston';

export class WinstonLogger implements LoggerService {
    constructor(private readonly logger: Logger) {}

    log(message: string) {
        this.logger.info(message);
    }

    error(message: string, trace?: string) {
        this.logger.error(message, { trace });
    }

    warn(message: string) {
        this.logger.warn(message);
    }

    debug(message: string) {
        this.logger.debug(message);
    }

    verbose(message: string) {
        this.logger.verbose(message);
    }
}
