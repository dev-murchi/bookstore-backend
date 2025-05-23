import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PasswordResetRequestDto {
  @ApiProperty({
    description: 'Email address to send password reset to',
    example: 'user@email.com',
  })
  @IsEmail()
  email: string;
}
