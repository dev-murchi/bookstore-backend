import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CartItemDTO } from './cart-item.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CartDTO {
  @ApiProperty({
    description: 'Unique identifier for the cart',
    example: 101,
  })
  @IsNotEmpty()
  @IsNumber()
  readonly id: number;

  @ApiProperty({
    description: 'User ID of the cart owner',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6',
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
    id: number,
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
