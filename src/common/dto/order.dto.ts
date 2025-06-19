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
import { OrderOwnerDTO } from './order-owner.dto';

export class OrderDTO {
  @ApiProperty({
    description: 'Unique identifier of the order',
    type: String,
    example: 'a1b2c3d4-e5f6-7890-abcd-123456789abc',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description:
      'Details of the owner of the order, either a registered user or a guest.',
    type: OrderOwnerDTO,
    nullable: true,
  })
  @IsOptional()
  @Type(() => OrderOwnerDTO)
  owner?: OrderOwnerDTO | null;

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
