import { IsInt, IsPositive } from 'class-validator';

export class CartItemDto {
  @IsInt()
  cartId: number;

  @IsInt()
  bookId: number;

  @IsInt()
  @IsPositive()
  quantity: number;
}
