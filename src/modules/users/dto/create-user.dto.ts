import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({
        example: 'John Doe',
        description: 'The name of the user',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        example: 'john.doe@example.com',
        description: 'The email address of the user',
        uniqueItems: true, // Example of adding a custom property
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'securePassword123',
        description: "The user's password",
        minLength: 8,
        writeOnly: true, // Important for sensitive fields like passwords
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}
