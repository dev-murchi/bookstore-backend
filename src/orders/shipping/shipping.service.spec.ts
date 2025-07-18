import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from './shipping.service';
import { PrismaService } from 'src/prisma/prisma.service';

const mockPrismaService = {
  shipping: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('ShippingService', () => {
  let service: ShippingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createShipping', () => {
    it('should successfully create a shipping record', async () => {
      const orderId = 'order-uuid-1';

      const shippingData = {
        email: 'testuser@example.com',
        name: 'test user',
        address: {
          line1: 'Test Street 123',
          line2: 'Apt 101',
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          postalCode: '12345',
        },
      };
      const mockResult = { id: 1, ...shippingData };
      mockPrismaService.shipping.create.mockResolvedValueOnce(mockResult);

      const result = await service.createShipping(orderId, shippingData);

      expect(mockPrismaService.shipping.create).toHaveBeenCalledWith({
        data: {
          email: shippingData.email,
          name: shippingData.name,
          order: { connect: { id: orderId } },
          address: {
            create: {
              country: shippingData.address.country,
              state: shippingData.address.state,
              city: shippingData.address.city,
              line1: shippingData.address.line1,
              line2: shippingData.address.line2,
              postalCode: shippingData.address.postalCode,
            },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle missing optional address line2 gracefully', async () => {
      const orderId = 'order-uuid-2';
      const shippingData = {
        email: 'no-line2@example.com',
        name: 'no line 2 user',
        address: {
          line1: 'Test Avenue 456',
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          postalCode: '54321',
        },
      };
      const mockResult = { id: 2, ...shippingData };
      mockPrismaService.shipping.create.mockResolvedValueOnce(mockResult);

      const result = await service.createShipping(orderId, shippingData);

      expect(mockPrismaService.shipping.create).toHaveBeenCalledWith({
        data: {
          email: shippingData.email,
          name: shippingData.name,
          order: { connect: { id: orderId } },
          address: {
            create: {
              country: shippingData.address.country,
              state: shippingData.address.state,
              city: shippingData.address.city,
              line1: shippingData.address.line1,
              line2: undefined,
              postalCode: shippingData.address.postalCode,
            },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when Prisma throws an exception', async () => {
      const orderId = 'order-uuid-3';
      const shippingData = {
        email: 'error@example.com',
        name: 'error user',
        address: {
          line1: 'Test Road 789',
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          postalCode: '67890',
        },
      };
      const error = new Error('Prisma error');
      mockPrismaService.shipping.create.mockRejectedValueOnce(error);

      await expect(
        service.createShipping(orderId, shippingData),
      ).rejects.toThrow(
        `Shipping details could not be created for Order ${orderId}`,
      );
    });
  });

  describe('findByOrder', () => {
    it('should throw error when database fails', async () => {
      const orderId = 'order-uuid-1';
      mockPrismaService.shipping.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.findByOrder(orderId)).rejects.toThrow(
        new Error(`Failed to find a shipping for the order ${orderId}`),
      );
    });
    it('should return null a shipping for the order is not exist', async () => {
      const orderId = 'order-uuid-1';
      mockPrismaService.shipping.findUnique.mockResolvedValueOnce(null);

      const result = await service.findByOrder(orderId);
      expect(result).toBeNull();
    });
    it('should find the shipping for the order', async () => {
      const orderId = 'order-uuid-1';

      const shippingData = {
        id: 1,
        orderId,
        address: {
          line1: 'Test Street 123',
          line2: 'Apt 101',
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          postalCode: '12345',
        },
        email: 'testuser@example.com',
        name: 'test user',
      };

      mockPrismaService.shipping.findUnique.mockResolvedValueOnce(shippingData);

      const result = await service.findByOrder(orderId);

      expect(result).toEqual(shippingData);
    });
  });
});
