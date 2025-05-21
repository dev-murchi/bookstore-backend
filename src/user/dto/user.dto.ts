import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class UserDTO {
  @ApiProperty({
    description: 'User ID',
    example: 'abcdef01-2345-6789-abcd-ef0123456789',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'johndoe@email.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User role', example: 'user' })
  @IsString()
  role: string;

  constructor(id: string, name: string, email: string, role: string) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.role = role;
  }
}
