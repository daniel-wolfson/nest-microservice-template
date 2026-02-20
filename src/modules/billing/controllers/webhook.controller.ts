import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StripeService } from '../services/stripe.service';

@ApiTags('webhooks')
@Controller('billing/webhook')
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(private readonly stripeService: StripeService) {}

    @Post('stripe')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Handle Stripe webhook events' })
    @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
    async handleStripeWebhook(@Body() payload: any, @Headers('stripe-signature') signature: string) {
        try {
            await this.stripeService.handleWebhook(payload, signature);
            return { received: true };
        } catch (error) {
            this.logger.error('Stripe webhook error:', error);
            throw error;
        }
    }

    @Post('yookassa')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Handle YooKassa webhook events' })
    @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
    async handleYooKassaWebhook(@Body() payload: any) {
        try {
            // Implement YooKassa webhook handling
            this.logger.log('YooKassa webhook received:', payload);
            return { received: true };
        } catch (error) {
            this.logger.error('YooKassa webhook error:', error);
            throw error;
        }
    }
}
