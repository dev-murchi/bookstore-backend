import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { OrderStatus } from '../enum/order-status.enum';

export class OrderStatusDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (!Object.values(OrderStatus).includes(value))
      throw new Error('Invalid order status.');
    return value;
  })
  status: string;
}
