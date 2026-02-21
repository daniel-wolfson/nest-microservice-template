// src/common/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    constructor(private readonly configService: ConfigService) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

        let status: number;
        let message: string | object;
        let error: string;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
                error = exception.name;
            } else {
                message = (exceptionResponse as any).message || exceptionResponse;
                error = (exceptionResponse as any).error || exception.name;
            }
        } else if (exception instanceof Error) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = isProduction ? 'Internal server error' : exception.message;
            error = exception.name || 'InternalServerError';
        } else {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Unknown error occurred';
            error = 'UnknownError';
        }

        // Log the error
        const errorLog = {
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            status,
            error,
            message,
            userAgent: request.get('User-Agent'),
            ip: request.ip,
            ...(exception instanceof Error &&
                !isProduction && {
                    stack: exception.stack,
                }),
        };

        if (status >= 500) {
            this.logger.error('Internal Server Error', JSON.stringify(errorLog, null, 2));
        } else if (status >= 400) {
            this.logger.warn('Client Error', JSON.stringify(errorLog, null, 2));
        }

        // Response format
        const errorResponse = {
            success: false,
            statusCode: status,
            error,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            ...(request.user && { userId: request.user?.userId }),
            ...(!isProduction &&
                exception instanceof Error && {
                    stack: exception.stack,
                }),
        };

        response.status(status).json(errorResponse);
    }
}
