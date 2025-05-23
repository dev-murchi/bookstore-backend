import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { OrderStatus } from '../../common/enum/order-status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class OrderStatusDto {
  @ApiProperty({
    description: 'Status of the order',
    enum: OrderStatus,
    enumName: 'OrderStatus',
    example: OrderStatus.Pending,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (!Object.values(OrderStatus).includes(value))
      throw new Error('Invalid order status.');
    return value;
  })
  status: string;
}
