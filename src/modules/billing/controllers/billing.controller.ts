import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateSubscriptionCommand } from '../commands/impl/create-subscription.command';
import { CancelSubscriptionCommand } from '../commands/impl/cancel-subscription.command';
import { DepositCommand } from '../commands/impl/deposit.command';
import { WithdrawCommand } from '../commands/impl/withdraw.command';
import { GetBalanceQuery } from '../queries/impl/get-balance.query';
import { GetInvoicesQuery } from '../queries/impl/get-invoices.query';
import { GetSubscriptionQuery } from '../queries/impl/get-subscription.query';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { DepositDto } from '../dto/deposit.dto';
import { WithdrawDto } from '../dto/withdraw.dto';

@ApiTags('billing')
@Controller('billing')
// @UseGuards(JwtAuthGuard) // Uncomment when auth is implemented
export class BillingController {
    constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

    @Post('subscription/create')
    @ApiOperation({ summary: 'Create a new subscription' })
    @ApiResponse({ status: 201, description: 'Subscription created successfully' })
    @ApiBearerAuth()
    async createSubscription(@Body() dto: CreateSubscriptionDto) {
        return this.commandBus.execute(new CreateSubscriptionCommand(dto.userId, dto.planId, dto.paymentMethodId));
    }

    @Post('subscription/:id/cancel')
    @ApiOperation({ summary: 'Cancel a subscription' })
    @ApiResponse({ status: 200, description: 'Subscription canceled successfully' })
    @ApiBearerAuth()
    async cancelSubscription(@Param('id') subscriptionId: string) {
        return this.commandBus.execute(new CancelSubscriptionCommand(subscriptionId));
    }

    @Get(':userId/balance')
    @ApiOperation({ summary: 'Get user balance' })
    @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
    @ApiBearerAuth()
    async getBalance(@Param('userId') userId: string) {
        return this.queryBus.execute(new GetBalanceQuery(userId));
    }

    @Post('deposit')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Deposit funds to user account' })
    @ApiResponse({ status: 200, description: 'Deposit initiated successfully' })
    @ApiBearerAuth()
    async deposit(@Body() dto: DepositDto) {
        return this.commandBus.execute(new DepositCommand(dto.userId, dto.amount, dto.paymentMethodId));
    }

    @Post('withdraw')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Withdraw funds from user account' })
    @ApiResponse({ status: 200, description: 'Withdrawal initiated successfully' })
    @ApiBearerAuth()
    async withdraw(@Body() dto: WithdrawDto) {
        return this.commandBus.execute(new WithdrawCommand(dto.userId, dto.amount, dto.destination));
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
