import { IsString, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Withdrawal amount', minimum: 0.01 })
    @IsNumber()
    @Min(0.01)
    amount: number;

    @ApiProperty({ description: 'Destination account or payment method' })
    @IsString()
    @IsNotEmpty()
    destination: string;
}
