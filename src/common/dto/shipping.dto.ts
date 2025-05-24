import { IsEmail, IsString, ValidateNested } from 'class-validator';
import { AddressDTO } from './address.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ShippingDTO {
  @ApiProperty({
    description: 'Email address of the recipient',
    type: String,
    example: 'example@email.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number of the recipient',
    type: String,
    example: '123-456-7890',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Shipping address of the recipient',
    type: AddressDTO,
  })
  @ValidateNested({ each: true })
  @Type(() => AddressDTO)
  address: AddressDTO;
}
