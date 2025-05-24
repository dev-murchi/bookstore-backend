import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class PasswordResetDTO {
  @ApiProperty({
    description: 'Email for the password reset',
    example: 'user@email.com',
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
    example: 'NewP@ssword.123',
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
