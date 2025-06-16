import { ApiProperty } from '@nestjs/swagger';

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class UpdateUserDTO {
  @ApiProperty({
    description: 'User email address',
    example: 'frodo@bookstore.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiProperty({
    description: 'Secure password with upper, lower, number, symbol',
    example: 'RingBearer#9Fingers!',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  password?: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'Frodo Baggins',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    description: 'User role (admin, user, etc.)',
    required: false,
    example: 'user',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role?: string;
}
