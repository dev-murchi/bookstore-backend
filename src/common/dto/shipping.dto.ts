import { IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AddressDTO } from './address.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ShippingDTO {
  @ApiProperty({
    description: 'Email address of the recipient',
    type: String,
    example: 'nazgul@bookstore.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number of the recipient',
    type: String,
    example: '999-009-0009',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Shipping address of the recipient',
    type: AddressDTO,
  })
  @ValidateNested({ each: true })
  @Type(() => AddressDTO)
  address: AddressDTO;
}
