import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CartItemDTO } from './cart-item.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CartDTO {
  @ApiProperty({
    description: 'Unique identifier for the cart',
    example: 'uuid',
  })
  @IsUUID()
  readonly id: string;

  @ApiProperty({
    description: 'User ID of the cart owner',
    example: 'abcdef01-2345-6789-abcd-ef0123456789',
  })
  @IsString()
  @IsNotEmpty()
  readonly owner: string;

  @ApiProperty({
    description: 'List of items in the cart',
    type: [CartItemDTO],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDTO)
  readonly items: CartItemDTO[];

  @ApiProperty({
    description: 'Total price of all items in the cart',
    example: 49.99,
  })
  @IsNumber()
  readonly totalPrice: number;

  constructor(
    id: string,
    owner: string,
    totalPrice: number,
    items: CartItemDTO[],
  ) {
    this.id = id;
    this.owner = owner;
    this.totalPrice = totalPrice;
    this.items = items;
  }
}
