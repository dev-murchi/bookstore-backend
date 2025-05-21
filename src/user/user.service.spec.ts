import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';

import { UpdateUserDTO } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum } from '../common/role.enum';

import { CustomAPIError } from '../common/errors/custom-api.error';
import { HelperService } from '../common/helper.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  password_reset_tokens: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();

    const fixedDate = new Date('2025-05-01T00:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a user if email is not taken', async () => {
      const userData = {
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: RoleEnum.User,
      };

      const spyUUID = jest.spyOn(HelperService, 'generateUUID');
      spyUUID.mockReturnValueOnce('user-1');
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValueOnce({
        userid: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: { role_name: 'user' },
      });
      const spyHash = jest.spyOn(HelperService, 'generateHash');
      spyHash.mockResolvedValueOnce('hashedPassword');

      const result = await service.create(userData);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: 'test user',
          email: 'testuser@email.com',
          password: 'hashedPassword',
          userid: 'user-1',
          role: {
            connectOrCreate: {
              where: {
                role_name: 'user',
              },
              create: {
                role_name: 'user',
              },
            },
          },
          is_active: true,
        },
        select: {
          userid: true,
          name: true,
          email: true,
          password: true,
          role: { select: { id: true, role_name: true } },
        },
      });

      expect(spyHash).toHaveBeenCalledWith(userData.password);

      expect(result).toEqual({
        id: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: 'user',
      });

      spyHash.mockRestore();
      spyUUID.mockRestore();
    });

    it('should throw an error if email is already in use', async () => {
      const userData = {
        name: 'new user',
        email: 'testuser@email.com',
        password: 'password123',
        role: RoleEnum.User,
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      try {
        await service.create(userData);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Email already in use');
      }
    });
  });

  describe('findAll', () => {
    it('should return empty array if  there is no users', async () => {
      mockPrismaService.user.findMany.mockResolvedValueOnce([]);

      expect(await service.findAll()).toEqual([]);
    });

    it('should return all users', async () => {
      mockPrismaService.user.findMany.mockResolvedValueOnce([
        {
          id: 1,
          userid: 'user-1',
          name: 'test user',
          email: 'testuser@email.com',
          role: {
            id: 1,
            role_name: 'user',
          },
          is_active: true,
        },
      ]);

      expect(await service.findAll()).toEqual([
        {
          id: 'user-1',
          name: 'test user',
          email: 'testuser@email.com',
          role: 'user',
        },
      ]);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 1,
        userid: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      const user = await service.findById('user-1');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          userid: 'user-1',
        },
        select: {
          id: true,
          userid: true,
          name: true,
          email: true,
          password: true,
          role: {
            select: {
              id: true,
              role_name: true,
            },
          },
          is_active: true,
        },
      });

      expect(user).toEqual({
        id: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: 'user',
      });
    });

    it('should return null if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      expect(await service.findById('user-999')).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 1,
        userid: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      const user = await service.findByEmail('testuser@email.com');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: 'testuser@email.com',
        },
        select: {
          id: true,
          userid: true,
          name: true,
          email: true,
          password: true,
          role: {
            select: {
              id: true,
              role_name: true,
            },
          },
          is_active: true,
        },
      });

      expect(user).toEqual({
        id: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: 'user',
      });
    });

    it('should throw an error if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      expect(await service.findByEmail('invaliduser@email.com')).toBeNull();
    });
  });

  describe('update', () => {
    it('should successfully update a user', async () => {
      const updatedUserDTO: UpdateUserDTO = {
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
      };

      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 1,
        userid: 'user-1',
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      const spy = jest.spyOn(HelperService, 'generateHash');
      spy.mockResolvedValueOnce('hashedPassword');

      const result = await service.update('user-1', updatedUserDTO);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { userid: 'user-1' },
        data: {
          name: 'updated test user',
          email: 'updatedtestuser@email.com',
          password: 'hashedPassword',
        },
        select: {
          userid: true,
          name: true,
          email: true,
          password: true,
          role: { select: { id: true, role_name: true } },
        },
      });

      expect(result).toEqual({
        id: 'user-1',
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        role: 'user',
      });

      spy.mockRestore();
    });

    it('should throw an error if user does not exist', async () => {
      const user: UpdateUserDTO = {
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
      };

      mockPrismaService.user.update.mockRejectedValueOnce(
        new Error('User to update not found'),
      );

      try {
        await service.update('user-999', user);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('User could not be updated');
      }
    });

    it('should throw an error if no changes provided', async () => {
      try {
        await service.update('user-999', {});
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('No changes provided.');
      }
    });
  });

  describe('remove', () => {
    it('should successfully delete a user', async () => {
      mockPrismaService.user.delete.mockResolvedValueOnce({
        id: 1,
        user: 'user-1',
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);

      const result = await service.remove('user-1');
      expect(result).toEqual({ message: 'User deleted successfully' });

      expect(await service.findById('user-1')).toBeNull();
    });
    it('should throw an error if user does not exist', async () => {
      mockPrismaService.user.delete.mockRejectedValueOnce(
        'User to delete not found',
      );
      try {
        await service.remove('user-1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('User could not be deleted');
      }
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create and return a disposable token', async () => {
      const mockUserId = 'user-1';

      const spy = jest.spyOn(HelperService, 'generateUUID');
      spy.mockReturnValueOnce('mock-uuid-token');

      mockPrismaService.user.update.mockResolvedValueOnce({});

      const result = await service.createPasswordResetToken(mockUserId);

      expect(spy).toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { userid: mockUserId },
        data: {
          password_reset_tokens: {
            create: {
              token: 'mock-uuid-token',
              expires_at: expect.any(Date),
            },
          },
        },
      });
      expect(result).toEqual({
        token: 'mock-uuid-token',
        expiresAt: expect.any(Date),
      });
      spy.mockRestore();
    });

    it('should throw an error if Prisma update fails', async () => {
      const mockUserId = 'user-1';

      const spy = jest.spyOn(HelperService, 'generateUUID');
      spy.mockReturnValueOnce('mock-uuid-token');

      mockPrismaService.user.update.mockRejectedValueOnce(
        new Error('DB error'),
      );

      await expect(
        service.createPasswordResetToken(mockUserId),
      ).rejects.toThrow(
        new CustomAPIError('Password reset token could not be created.'),
      );
      spy.mockRestore();
    });
  });

  describe('resetPassword', () => {
    it('should throw an error if the token is invalid', async () => {
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce(
        null,
      );

      try {
        await service.resetPassword(
          'testuser@email.com',
          'invalid-token',
          'newpassword',
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Invalid token');
        expect(
          prismaService.password_reset_tokens.findUnique,
        ).toHaveBeenCalledWith({
          where: {
            token: 'invalid-token',
          },
        });
      }
    });

    it('should throw an error if the token has expired', async () => {
      const currentDateTime = Date.now();

      const mockPasswordResetData = {
        token_id: 1,
        userid: 1,
        token: 'token',
        expires_at: new Date(currentDateTime - 60 * 1000), // token expired 1 minute ago
      };
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce(
        mockPasswordResetData,
      );
      mockPrismaService.password_reset_tokens.delete.mockReturnValueOnce(
        mockPasswordResetData,
      );

      try {
        await service.resetPassword(
          'testuse@email.com',
          'token',
          'newpassword',
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Expired token');
        expect(
          prismaService.password_reset_tokens.findUnique,
        ).toHaveBeenCalledWith({
          where: { token: 'token' },
        });

        expect(prismaService.password_reset_tokens.delete).toHaveBeenCalledWith(
          {
            where: { token: 'token' },
          },
        );
      }
    });

    it('should throw an error if the email does not match the token', async () => {
      const currentDateTime = Date.now();
      const mockPasswordResetData = {
        token_id: 1,
        userid: 'user-1',
        token: 'token',
        expires_at: new Date(currentDateTime + 10 * 60 * 1000), // token will expire 10 minutes later
      };
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValue(
        mockPasswordResetData,
      );

      mockPrismaService.user.findUnique
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({
          name: 'second user',
          id: 2,
          userid: 'user-2',
          email: 'seconduser@email.com',
          password: 'oldpassword',
          role: { id: 1, role_name: 'user' },
          is_active: true,
        });

      try {
        await service.resetPassword(
          'unknownuser@email.com',
          'token',
          'newpassword',
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Invalid email');
      }

      try {
        await service.resetPassword(
          'seconduser@email.com',
          'token',
          'newpassword',
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Invalid email');
      }

      mockPrismaService.password_reset_tokens.findUnique.mockClear();
    });

    it('should throw an error if the new password is the same as the old password', async () => {
      const currentDateTime = Date.now();
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce({
        token_id: 1,
        userid: 'user-1',
        token: 'token',
        expires_at: new Date(currentDateTime + 10 * 60 * 1000), // token will expire 10 minutes later
      });

      mockPrismaService.user.findUnique.mockReturnValueOnce({
        name: 'test user',
        id: 1,
        userid: 'user-1',
        email: 'testuser@email.com',
        password: 'oldpassword',
        role: { id: 1, role_name: 'user' },
        is_active: true,
      });

      const spy = jest.spyOn(HelperService, 'compareHash');
      spy.mockResolvedValueOnce(true);

      try {
        await service.resetPassword(
          'testuser@email.com',
          'token',
          'oldpassword',
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe(
          'New password must be different from the current password. Please try again.',
        );
        spy.mockRestore();
      }
    });

    it('should reset the password successfully', async () => {
      const currentDateTime = Date.now();
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce({
        token_id: 1,
        userid: 'user-1',
        token: 'token',
        expires_at: new Date(currentDateTime + 10 * 60 * 1000), // token will expire 10 minutes later
      });

      mockPrismaService.user.findUnique.mockReturnValueOnce({
        name: 'test user',
        id: 1,
        userid: 'user-1',
        email: 'testuser@email.com',
        password: 'oldpassword',
        role: { id: 1, role_name: 'user' },
        is_active: true,
      });

      mockPrismaService.user.update.mockResolvedValueOnce({
        name: 'test user',
        userid: 'user-1',
        email: 'testuser@email.com',
        role: { role_name: 'user' },
      });

      const spyCampare = jest.spyOn(HelperService, 'compareHash');
      spyCampare.mockResolvedValueOnce(false);

      const spyHash = jest.spyOn(HelperService, 'generateHash');
      spyHash.mockResolvedValueOnce('hashedPassword');

      const updateSpy = jest.spyOn(service, 'update');

      const result = await service.resetPassword(
        'testuser@email.com',
        'token',
        'newpassword',
      );

      expect(updateSpy).toHaveBeenCalledWith('user-1', {
        password: 'newpassword',
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1);

      expect(
        mockPrismaService.password_reset_tokens.delete,
      ).toHaveBeenCalledWith({
        where: { token: 'token' },
      });

      expect(result).toEqual({ message: 'Password reset successfully' });
      spyCampare.mockRestore();
      spyHash.mockRestore();
    });
  });
});
