import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvoiceDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Invoice amount', minimum: 0.01 })
    @IsNumber()
    @Min(0.01)
    amount: number;

    @ApiProperty({ description: 'Description', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Due date (ISO string)', required: false })
    @IsString()
    @IsOptional()
    dueDate?: string;
}
