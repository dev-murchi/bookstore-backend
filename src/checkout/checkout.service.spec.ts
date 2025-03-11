import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  $transactio: jest.fn(),
  cart_items: {
    findMany: jest.fn(),
  },
  orders: {
    create: jest.fn(),
  },
  books: {
    update: jest.fn(),
  },
  cart: {
    delete: jest.fn(),
  },
};

describe('CheckoutService', () => {
  let service: CheckoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
