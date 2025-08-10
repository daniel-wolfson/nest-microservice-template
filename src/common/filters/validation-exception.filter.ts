// src/common/filters/validation-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(ValidationExceptionFilter.name);

    catch(exception: BadRequestException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus();

        const exceptionResponse = exception.getResponse();
        let validationErrors: any = {};

        if (typeof exceptionResponse === 'object' && (exceptionResponse as any).message) {
            const messages = (exceptionResponse as any).message;
            if (Array.isArray(messages)) {
                // Transform class-validator errors
                validationErrors = messages.reduce((acc, curr) => {
                    if (typeof curr === 'string') {
                        acc.general = acc.general || [];
                        acc.general.push(curr);
                    }
                    return acc;
                }, {});
            }
        }

        this.logger.warn(`Validation Error: ${request.method} ${request.url}`, {
            errors: validationErrors,
            body: request.body,
        });

        const errorResponse = {
            success: false,
            statusCode: status,
            error: 'Validation Error',
            message: 'Request validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
        };

        response.status(status).json(errorResponse);
    }
}
