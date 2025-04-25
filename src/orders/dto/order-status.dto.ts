import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

const OrderStatus = [
  'pending',
  'expired',
  'complete',
  'shipped',
  'delivered',
  'canceled',
] as const;

export class OrderStatusDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (!OrderStatus.includes(value)) throw new Error('Invalid order status.');
    return value;
  })
  status: string;
}
