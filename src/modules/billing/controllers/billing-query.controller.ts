import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GetBalanceQuery } from '../queries/impl/get-balance.query';
import { GetInvoicesQuery } from '../queries/impl/get-invoices.query';
import { GetSubscriptionQuery } from '../queries/impl/get-subscription.query';

@ApiTags('billing')
@Controller('billing')
// @UseGuards(JwtAuthGuard) // Uncomment when auth is implemented
export class BillingQueryController {
    constructor(private readonly queryBus: QueryBus) {}

    @Get(':userId/balance')
    @ApiOperation({ summary: 'Get user balance' })
    @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
    @ApiBearerAuth()
    async getBalance(@Param('userId') userId: string) {
        return this.queryBus.execute(new GetBalanceQuery(userId));
    }

    @Get('invoices/:userId')
    @ApiOperation({ summary: 'Get user invoices' })
    @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
    @ApiBearerAuth()
    async getInvoices(@Param('userId') userId: string) {
        return this.queryBus.execute(new GetInvoicesQuery(userId));
    }

    @Get('subscription/:userId')
    @ApiOperation({ summary: 'Get user subscription' })
    @ApiResponse({ status: 200, description: 'Subscription retrieved successfully' })
    @ApiBearerAuth()
    async getSubscription(@Param('userId') userId: string) {
        return this.queryBus.execute(new GetSubscriptionQuery(userId));
    }
}
