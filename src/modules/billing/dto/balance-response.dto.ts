import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
    @ApiProperty({ description: 'User ID' })
    userId: string;

    @ApiProperty({ description: 'Current balance' })
    balance: number;

    @ApiProperty({ description: 'Currency code (e.g., USD)' })
    currency: string;
}
