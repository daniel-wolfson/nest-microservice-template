import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
    @Get()
    @ApiOperation({ summary: 'Get application info' })
    @ApiResponse({
        status: 200,
        description: 'Application information',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                version: { type: 'string' },
                description: { type: 'string' },
                environment: { type: 'string' },
                timestamp: { type: 'string' },
            },
        },
    })
    getAppInfo() {
        return {
            name: 'Microservice Template',
            version: '1.0.0',
            description: 'NestJS Microservice Template with Logging, Authentication, and RabbitMQ',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            endpoints: {
                health: '/health',
                auth: '/auth',
                swagger: '/api',
            },
        };
    }

    @Get('health')
    @ApiOperation({ summary: 'Health check endpoint' })
    @ApiResponse({
        status: 200,
        description: 'Service health status',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string' },
                timestamp: { type: 'string' },
                uptime: { type: 'number' },
            },
        },
    })
    getHealth() {
        return {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        };
    }
}
