import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Request } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      await this.paymentService.handleStripeWebhook(request.rawBody, signature);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to handle the stripe webhook events.',
      );
    }
  }
}
