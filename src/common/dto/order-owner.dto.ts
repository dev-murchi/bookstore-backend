import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class OrderOwnerDTO {
  @ApiProperty({
    description: 'UUID of the user who owns the order. This field is optional.',
    type: String,
    example: 'abcdef01-2345-6789-abcd-ef0123456789',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @ApiProperty({
    description: 'Name of the user who owns the order.',
    type: String,
    example: 'Nazgul',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Email of the user who owns the order.',
    type: String,
    example: 'nazgul@bookstore.com',
  })
  @IsEmail()
  email: string;

  constructor(id: string | null, name: string, email: string) {
    this.id = id ? id : null;
    this.name = name;
    this.email = email;
  }
}
