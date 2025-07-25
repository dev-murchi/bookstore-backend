import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { InternalServerErrorException } from '@nestjs/common';

const mockPaymentService = {
  handleStripeWebhook: jest.fn(),
};

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('stripeWebhook', () => {
    const request = { rawBody: Buffer.from('payload') } as any;
    const signature = 'sig_123';

    it('should throw InternalServerErrorException on error', async () => {
      mockPaymentService.handleStripeWebhook.mockRejectedValue(
        new Error('Unknown Error'),
      );
     
      try {
        await controller.stripeWebhook(request, signature);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to handle the stripe webhook events.',
        );
      }
    });

    it('should handle stripe webhook successfully', async () => {
      mockPaymentService.handleStripeWebhook.mockResolvedValue(undefined);
      const result = await controller.stripeWebhook(request, signature);
      expect(result).toBeUndefined();
      expect(mockPaymentService.handleStripeWebhook).toHaveBeenCalledWith(
        request.rawBody,
        signature,
      );
    });
  });
});
