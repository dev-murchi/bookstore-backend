import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsStrongPassword,
  IsOptional,
} from 'class-validator';

export class UpdateProfileDTO {
  @ApiProperty({
    description: 'Updated full name',
    required: false,
    example: 'Jane Doe',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Updated email',
    required: false,
    example: 'frodo@bookstore.com',
  })
  @IsEmail()
  @IsNotEmpty()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'User password', example: 'BagEnd@Shire1420!' })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'New password to change to',
    required: false,
    example: 'RingBearer#9Fingers!',
  })
  @IsStrongPassword()
  @IsOptional()
  newPassword?: string;
}
