import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentDTO {
  @ApiProperty({
    description: 'Transaction ID for the payment (optional)',
    type: String,
    required: false,
    example: 'tx123abc456',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  transactionId?: string;

  @ApiProperty({
    description: 'Payment status (e.g., completed, pending, failed)',
    type: String,
    example: 'completed',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Payment method used (e.g., credit card, PayPal, etc.)',
    type: String,
    example: 'credit card',
  })
  @IsNotEmpty()
  @IsString()
  method: string;

  @ApiProperty({
    description: 'Amount of the payment in the currency (e.g., USD, EUR)',
    type: Number,
    example: 100.5,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;
}
