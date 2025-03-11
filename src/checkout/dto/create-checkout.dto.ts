import { IsInt } from 'class-validator';

export class CreateCheckoutDto {
  @IsInt()
  cartId: number;
}
