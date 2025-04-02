import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
