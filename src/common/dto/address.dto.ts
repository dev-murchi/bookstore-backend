import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddressDTO {
  @ApiProperty({
    description: 'Country of the address',
    type: String,
    example: 'The Shire',
  })
  @IsString()
  country: string;

  @ApiProperty({
    description: 'State of the address (optional)',
    type: String,
    required: false,
    example: 'Bree',
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: 'City of the address',
    type: String,
    example: 'Hobbiton',
  })
  @IsString()
  city: string;

  @ApiProperty({
    description: 'Line 1 of the address',
    type: String,
    example: 'Bag End, Hobbiton',
  })
  @IsString()
  line1: string;

  @ApiProperty({
    description: 'Line 2 of the address (optional)',
    type: String,
    required: false,
    example: 'Next to the Green Dragon Inn',
  })
  @IsString()
  @IsOptional()
  line2?: string;

  @ApiProperty({
    description: 'Postal code of the address',
    type: String,
    example: '4567',
  })
  @IsString()
  postalCode: string;
}
