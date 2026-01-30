import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';
import { Language } from '@prisma/client';
import { IsString, IsEmail, IsNotEmpty, IsBoolean, IsEnum } from 'class-validator';

@InputType()
export class CreateUserDto {
    @Field(() => String)
    @IsEnum(Language)
    language: Language;

    @Field(() => Boolean)
    @IsBoolean()
    terms: boolean;

    @ApiProperty({
        example: 'John Doe',
        description: 'The name of the user',
    })
    @Field(() => String)
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        example: 'john.doe@example.com',
        description: 'The email address of the user',
        uniqueItems: true, // Example of adding a custom property
    })
    @Field(() => String)
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'securePassword123',
        description: "The user's password",
        minLength: 8,
        writeOnly: true, // Important for sensitive fields like passwords
    })
    @Field(() => String)
    @IsString()
    @IsNotEmpty()
    password: string;
}
