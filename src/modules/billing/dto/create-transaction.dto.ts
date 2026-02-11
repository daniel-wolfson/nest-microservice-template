import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TransactionType {
    DEPOSIT = 'DEPOSIT',
    WITHDRAWAL = 'WITHDRAWAL',
    SUBSCRIPTION = 'SUBSCRIPTION',
    REFUND = 'REFUND',
    ADJUSTMENT = 'ADJUSTMENT',
    PAYMENT = 'PAYMENT',
}

export enum TransactionStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELED = 'CANCELED',
    REFUNDED = 'REFUNDED',
}

export enum TransactionState {
    CREATED = 'CREATED',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
    CANCELED = 'CANCELED',
}

export class CreateTransactionDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    userId: string;

    @ApiProperty({ enum: TransactionType })
    @IsEnum(TransactionType)
    type: TransactionType;

    @ApiProperty({ description: 'Transaction amount' })
    @IsNumber()
    amount: number;

    @ApiProperty({ description: 'Payment method ID', required: false })
    @IsString()
    @IsOptional()
    paymentMethodId?: string;

    @ApiProperty({ description: 'Description', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Idempotency key', required: false })
    @IsString()
    @IsOptional()
    idempotencyKey?: string;
}
