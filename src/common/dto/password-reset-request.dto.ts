import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PasswordResetRequestDTO {
  @ApiProperty({
    description: 'Email address to send the password reset link',
    example: 'dain.ironfoot@bookstore.com',
  })
  @IsEmail()
  email: string;
}
