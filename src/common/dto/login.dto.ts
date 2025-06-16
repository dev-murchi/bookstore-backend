import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class LoginDTO {
  @ApiProperty({
    description: 'User email',
    example: 'gandalf@middleearth.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User password', example: 'YouShallNotPass123!' })
  @IsNotEmpty()
  @IsStrongPassword()
  password: string;
}
