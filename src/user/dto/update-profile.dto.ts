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
    example: 'jane@email.com',
  })
  @IsEmail()
  @IsNotEmpty()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'User password', example: 'Str0ng-P@ssword1' })
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
    example: 'NewP@ssword.123',
  })
  @IsStrongPassword()
  @IsOptional()
  newPassword?: string;
}
