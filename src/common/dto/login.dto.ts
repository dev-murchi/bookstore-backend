import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class LoginDTO {
  @ApiProperty({ description: 'User email', example: 'login@email.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User password', example: 'Str0ng-P@ssword1' })
  @IsNotEmpty()
  @IsStrongPassword()
  password: string;
}
