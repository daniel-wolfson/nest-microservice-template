import { IsString, IsNumber, IsNotEmpty, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DepositDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Deposit amount', minimum: 0.01 })
    @IsNumber()
    @Min(0.01)
    amount: number;

    @ApiProperty({ description: 'Payment method ID', required: false })
    @IsString()
    @IsOptional()
    paymentMethodId?: string;
}
