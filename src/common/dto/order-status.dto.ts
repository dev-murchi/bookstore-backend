import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../common/enum/order-status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class OrderStatusDTO {
  @ApiProperty({
    description: 'Status of the order',
    enum: OrderStatus,
    enumName: 'OrderStatus',
    example: OrderStatus.Shipped,
  })
  @IsEnum(OrderStatus)
  status: string;
}
