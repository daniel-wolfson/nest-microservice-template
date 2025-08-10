import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ 
        example: 'user@example.com', 
        description: 'Valid email address',
        format: 'email'
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    @MaxLength(255, { message: 'Email must not exceed 255 characters' })
    email: string;

    @ApiProperty({ 
        example: 'SecurePassword123!', 
        description: 'Password must be at least 8 characters long',
        minLength: 8,
        maxLength: 128
    })
    @IsString({ message: 'Password must be a string' })
    @IsNotEmpty({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(128, { message: 'Password must not exceed 128 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
        message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    })
    password: string;
}
