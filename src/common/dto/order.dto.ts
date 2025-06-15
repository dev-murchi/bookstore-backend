import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingDTO } from './shipping.dto';
import { PaymentDTO } from './payment.dto';
import { OrderItemDTO } from './order-item.dto';
import { OrderStatus } from '../enum/order-status.enum';

export class OrderDTO {
  @ApiProperty({
    description: 'Unique identifier of the order',
    type: String,
    example: 'a1b2c3d4-e5f6-7890-abcd-123456789abc',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'UUID of the user who owns the order',
    type: String,
    example: 'abcdef01-2345-6789-abcd-ef0123456789',
  })
  @IsOptional()
  @IsUUID()
  owner?: string;

  @ApiProperty({
    description: 'List of items in the order',
    type: [OrderItemDTO],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDTO)
  items: OrderItemDTO[];

  @ApiProperty({
    description: 'Current status of the order',
    type: String,
    example: 'pending',
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty({
    description: 'Total price of the order',
    type: Number,
    example: 129.99,
  })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({
    description: 'Shipping information for the order',
    type: ShippingDTO,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingDTO)
  shipping?: ShippingDTO;

  @ApiPropertyOptional({
    description: 'Payment details for the order',
    type: PaymentDTO,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDTO)
  payment?: PaymentDTO;
}
