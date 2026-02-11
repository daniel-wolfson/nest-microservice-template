import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelSubscriptionDto {
    @ApiProperty({ description: 'Subscription ID' })
    @IsString()
    @IsNotEmpty()
    subscriptionId: string;

    @ApiProperty({ description: 'Cancel at period end', required: false })
    @IsBoolean()
    @IsOptional()
    cancelAtPeriodEnd?: boolean;
}
