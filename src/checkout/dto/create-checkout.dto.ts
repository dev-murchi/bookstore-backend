import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty()
  @IsInt()
  cartId: number;
}
