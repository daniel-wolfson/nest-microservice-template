import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Plan ID' })
    @IsString()
    @IsNotEmpty()
    planId: string;

    @ApiProperty({ description: 'Payment method ID', required: false })
    @IsString()
    @IsOptional()
    paymentMethodId?: string;
}
