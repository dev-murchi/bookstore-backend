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
import {
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@Controller('payment')
@ApiTags('Payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Stripe webhook events',
    description:
      'Endpoint for receiving and processing Stripe webhook events. It validates the event signature and triggers business logic accordingly.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    required: true,
    description:
      'The signature header sent by Stripe to verify the authenticity of the event.',
  })
  @ApiOkResponse({
    description: 'Webhook received and processed successfully.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to handle the Stripe webhook events.',
  })
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
