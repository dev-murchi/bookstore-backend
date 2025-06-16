import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class PasswordResetDTO {
  @ApiProperty({
    description: 'Email address to send the password reset link',
    example: 'frodo@bookstore.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Reset token sent to user',
    example: 'abc-123-reset-token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'New password to set',
    example: 'RingBearer#9Fingers!',
  })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  newPassword: string;
}
