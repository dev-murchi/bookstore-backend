import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddressDTO {
  @ApiProperty({
    description: 'Country of the address',
    type: String,
    example: 'Mordor',
  })
  @IsString()
  country: string;

  @ApiProperty({
    description: 'State of the address (optional)',
    type: String,
    required: false,
    example: 'Barad-dur',
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: 'City of the address',
    type: String,
    example: 'Udun',
  })
  @IsString()
  city: string;

  @ApiProperty({
    description: 'Line 1 of the address',
    type: String,
    example: 'The Dark Tower of Barad-dur',
  })
  @IsString()
  line1: string;

  @ApiProperty({
    description: 'Line 2 of the address (optional)',
    type: String,
    required: false,
    example: 'Overlooking the Plains of Gorgoroth',
  })
  @IsString()
  @IsOptional()
  line2?: string;

  @ApiProperty({
    description: 'Postal code of the address',
    type: String,
    example: '000009',
  })
  @IsString()
  postalCode: string;
}
