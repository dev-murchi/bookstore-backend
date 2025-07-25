import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { ReviewsService } from 'src/reviews/reviews.service';
import { OrdersService } from 'src/orders/orders.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { RoleEnum } from 'src/common/enum/role.enum';
import { UserDTO } from 'src/common/dto/user.dto';
import { OrderDTO } from 'src/common/dto/order.dto';
import { OrderStatus } from 'src/common/enum/order-status.enum';

const mockUserService = {
  findOne: jest.fn(),
  checkUserWithPassword: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  remove: jest.fn(),
};
const mockReviewsService = {
  getReviewsForUser: jest.fn(),
};
const mockOrdersService = {
  getUserOrders: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ handleRequest: jest.fn() })
      .compile();

    controller = module.get<UserController>(UserController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('profile', () => {
    it('should return user profile', async () => {
      const req = {
        user: {
          id: 'user-uuid-1',
          name: 'test user',
          email: 'testuser@email.com',
          role: RoleEnum.User,
        },
      } as any;
      const result = await controller.profile(req);
      expect(result).toEqual(
        new UserDTO(
          'user-uuid-1',
          'test user',
          'testuser@email.com',
          RoleEnum.User,
        ),
      );
    });
  });

  describe('updateProfile', () => {
    const req = {
      user: {
        id: 'user-uuid-1',
        email: 'testuser@email.com',
        role: RoleEnum.User,
      },
    } as any;

    it('should throw BadRequestException if no changes provided', async () => {
      try {
        const body = { password: 'OldPassword.123' } as any;
        await controller.updateProfile(req, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('No changes provided.');
      }
    });

    it('should throw BadRequestException if new password equals old password', async () => {
      try {
        const body = {
          password: 'OldPassword.123',
          newPassword: 'OldPassword.123',
        } as any;
        await controller.updateProfile(req, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'New password must be different from old password.',
        );
      }
    });

    it('should throw BadRequestException if CustomAPIError thrown', async () => {
      const body = { name: 'new user name', password: 'OldPassword.123' };

      mockUserService.checkUserWithPassword.mockRejectedValueOnce(
        new CustomAPIError('Invalid user credentials.'),
      );

      try {
        await controller.updateProfile(req, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user credentials.');
      }
    });

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const body = { name: 'new user name', password: 'OldPassword.123' };

      mockUserService.checkUserWithPassword.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.updateProfile(req, body);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('User profile update failed.');
      }
    });

    it('should update profile and require login if password changed', async () => {
      const body = {
        name: 'new user name',
        email: 'newuser@email.com',
        password: 'OldPassword.123',
        newPassword: 'NewPassword.123',
      };

      const expectedData: UserDTO = {
        id: req.user.id,
        name: 'new user name',
        email: 'newuser@email.com',
        role: req.user.role,
      };

      mockUserService.checkUserWithPassword.mockResolvedValueOnce({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      });

      mockUserService.update.mockResolvedValueOnce(expectedData);

      const result = await controller.updateProfile(req, body);
      expect(result).toEqual({
        data: expectedData,
        loginRequired: true,
      });
    });

    it('should update profile without password change', async () => {
      const body = { name: 'new user name', password: 'OldPassword.123' };
      mockUserService.checkUserWithPassword.mockResolvedValueOnce({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      });

      const expectedData: UserDTO = {
        id: req.user.id,
        name: 'new user name',
        email: req.user.email,
        role: req.user.role,
      };
      mockUserService.update.mockResolvedValueOnce(expectedData);

      const result = await controller.updateProfile(req, body);
      expect(result).toEqual({
        data: expectedData,
        loginRequired: false,
      });
    });

    it('should throw BadRequestException if password is missing', async () => {
      try {
        const body = { name: 'new user name' } as any;
        await controller.updateProfile(req, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Password is required.');
      }
    });
  });

  describe('viewAllRegisteredUsers', () => {
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockUserService.findAll.mockRejectedValueOnce(new Error('Unknown Error'));

      try {
        await controller.viewAllRegisteredUsers();
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Users could not be retrieved.');
      }
    });

    it('should return all users', async () => {
      const user: UserDTO = {
        id: 'user-uuid-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: RoleEnum.User,
      };
      mockUserService.findAll.mockResolvedValueOnce([user]);
      const result = await controller.viewAllRegisteredUsers();
      expect(result).toEqual([user]);
    });
  });

  describe('updateUser', () => {
    it('should throw BadRequestException if CustomAPIError thrown', async () => {
      mockUserService.update.mockRejectedValueOnce(
        new CustomAPIError('No changes provided.'),
      );

      try {
        await controller.updateUser('user-uuid-1', {});
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('No changes provided.');
      }
    });

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockUserService.update.mockRejectedValueOnce(new Error('Unknown Error'));
      try {
        await controller.updateUser('user-uuid-1', { name: 'new user name' });
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('User update failed.');
      }
    });

    it('should update user', async () => {
      const expectedData = {
        id: 'user-uuid-1',
        name: 'new user name',
        email: 'testuser@email.com',
        role: RoleEnum.User,
      };
      mockUserService.update.mockResolvedValueOnce(expectedData);
      const result = await controller.updateUser('user-uuid-1', {
        name: 'new user name',
      });
      expect(result).toEqual(expectedData);
    });
  });

  describe('deleteUser', () => {
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockUserService.remove.mockRejectedValueOnce(new Error('Unknown Error'));
      try {
        await controller.deleteUser('user-id-1');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('User could not be deleted.');
      }
    });

    it('should delete user', async () => {
      mockUserService.remove.mockResolvedValueOnce({
        message: 'User deleted successfully',
      });
      const result = await controller.deleteUser('user-uuid-1');
      expect(result).toEqual({ message: 'User deleted successfully' });
    });
  });

  describe('getUserReviews', () => {
    it('should throw InternalServerErrorException on error', async () => {
      mockReviewsService.getReviewsForUser.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.getUserReviews('user-uuid-1', 1, 10);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Failed to retrieve user reviews.');
      }
    });

    it('should return user reviews when user has no review', async () => {
      const expectedData = {
        data: { reviews: [], rating: 0 },
        meta: {
          userId: 'user-uuid-1',
          totalReviewCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };
      mockReviewsService.getReviewsForUser.mockResolvedValueOnce(expectedData);
      const result = await controller.getUserReviews('user-uuid-1', 1, 10);
      expect(result).toEqual({ data: expectedData });
    });

    it('should return user reviews when user has reviews', async () => {
      const expectedData = {
        data: {
          reviews: [
            {
              id: 'review-uuid-1',
              data: 'review first',
              rating: 4,
              bookId: 'book-uuid-1',
              ownerId: 'user-uuid-1',
            },
            {
              id: 'review-uuid-2',
              data: 'review second',
              rating: 3,
              bookId: 'book-uuid-2',
              ownerId: 'user-uuid-1',
            },
          ],
          rating: 3.5,
        },
        meta: {
          userId: 'user-uuid-1',
          totalReviewCount: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };
      mockReviewsService.getReviewsForUser.mockResolvedValueOnce(expectedData);
      const result = await controller.getUserReviews('user-uuid-1', 1, 10);
      expect(result).toEqual({ data: expectedData });
    });
  });

  describe('getUserOrders', () => {
    it('should throw InternalServerErrorException on error', async () => {
      mockOrdersService.getUserOrders.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.getUserOrders('user-uuid-1');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Failed to retrieve user orders.');
      }
    });

    it('should return user orders', async () => {
      const order: OrderDTO = {
        id: 'order-uuid-1',
        items: [
          {
            quantity: 2,
            item: {
              id: 'book-uuid-1',
              title: 'Book Title',
              description: 'Book description',
              isbn: '978-0451526342',
              author: {
                name: 'test author',
              },
              category: { id: 1, value: 'Fiction' },
              price: 10.99,
              rating: 3,
              imageUrl: 'https://image-url.com',
            },
          },
        ],
        status: OrderStatus.Pending,
        price: 21.98,
      };

      mockOrdersService.getUserOrders.mockResolvedValueOnce([order]);

      const result = await controller.getUserOrders('user-uuid-1');
      expect(result.data).toEqual([order]);
    });
  });
});
