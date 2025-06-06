import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';

import { UpdateUserDTO } from '../common/dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum } from '../common/enum/role.enum';

import { CustomAPIError } from '../common/errors/custom-api.error';
import { HelperService } from '../common/helper.service';
import { UserDTO } from '../common/dto/user.dto';

import * as classValidator from 'class-validator';

const mockUserId = '5610eb78-6602-4408-88f6-c2889cd136b7'; // just example
const mockUserId2 = '5610eb78-1234-4408-88f6-c2889cd136b7'; // just example
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
  let validateSpy;

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
    validateSpy = jest.spyOn(classValidator, 'validate');
    validateSpy.mockResolvedValue([]);
    jest.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime());
  });

  afterEach(() => {
    validateSpy.mockRestore();
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

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        role: { role_name: 'user' },
        last_password_reset_at: new Date(),
      });
      const spyHash = jest.spyOn(HelperService, 'generateHash');
      spyHash.mockResolvedValueOnce('hashedPassword');

      const result = await service.create(userData);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: 'test user',
          email: 'testuser@email.com',
          password: 'hashedPassword',
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
          last_password_reset_at: expect.any(Date),
        },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          role: { select: { id: true, role_name: true } },
        },
      });

      expect(spyHash).toHaveBeenCalledWith(userData.password);

      expect(result).toEqual({
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        role: 'user',
      });

      spyHash.mockRestore();
    });

    it('should throw an error if email is already in use', async () => {
      const userData = {
        name: 'new user',
        email: 'testuser@email.com',
        password: 'password123',
        role: RoleEnum.User,
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: mockUserId,
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

    it('should throw an error when db error occurs', async () => {
      mockPrismaService.user.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(
        service.create({
          name: 'test user',
          email: null as string,
          password: 'password123',
          role: RoleEnum.User,
        }),
      ).rejects.toThrow('User creation failed.');
    });
  });

  describe('transformSelectedUserToUser', () => {
    it('should transform user as UserDTO', async () => {
      const result = await service['transformSelectedUserToUser']({
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });
      expect(result).toEqual(
        new UserDTO(mockUserId, 'test user', 'testuser@email.com', 'user'),
      );
    });
    it('should throw error when validation fails', async () => {
      const user = {
        id: 1 as unknown as string,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      };
      validateSpy.mockResolvedValueOnce([
        {
          property: 'id',
          constraints: { isString: 'id must be a string' },
        },
      ] as any);

      await expect(
        service['transformSelectedUserToUser'](user),
      ).rejects.toThrow('Validation failed');
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
          id: mockUserId,
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
          id: mockUserId,
          name: 'test user',
          email: 'testuser@email.com',
          role: 'user',
        },
      ]);
    });
    it('should throw an error when db error occurs', async () => {
      mockPrismaService.user.findMany.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.findAll()).rejects.toThrow(
        'Users could not retrieved.',
      );
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      const user = await service.findById(mockUserId);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockUserId,
        },
        select: {
          id: true,
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
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        role: 'user',
      });
    });

    it('should return null if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      expect(await service.findById('user-999')).toBeNull();
    });

    it('should throw an error when db error occurs', async () => {
      mockPrismaService.user.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.findById(mockUserId)).rejects.toThrow(
        'User could not retrieved.',
      );
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: mockUserId,
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
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        role: 'user',
      });
    });

    it('should return null if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      expect(await service.findByEmail('invaliduser@email.com')).toBeNull();
    });

    it('should throw an error when db error occurs', async () => {
      mockPrismaService.user.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.findByEmail('nouser@email.com')).rejects.toThrow(
        'User could not retrieved.',
      );
    });
  });

  describe('update', () => {
    it('should successfully update a user', async () => {
      const updatedUserDTO: UpdateUserDTO = {
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
        role: 'author',
      };

      mockPrismaService.user.update.mockResolvedValueOnce({
        id: mockUserId,
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        role: {
          id: 1,
          role_name: 'author',
        },
        is_active: true,
      });

      const spy = jest.spyOn(HelperService, 'generateHash');
      spy.mockResolvedValueOnce('hashedPassword');

      const result = await service.update(mockUserId, updatedUserDTO);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          name: 'updated test user',
          email: 'updatedtestuser@email.com',
          password: 'hashedPassword',
          last_password_reset_at: expect.any(Date),
          role: { connect: { role_name: 'author' } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          role: { select: { id: true, role_name: true } },
        },
      });

      expect(result).toEqual({
        id: mockUserId,
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        role: 'author',
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
        id: mockUserId,
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

      const result = await service.remove(mockUserId);
      expect(result).toEqual({ message: 'User deleted successfully' });

      expect(await service.findById(mockUserId)).toBeNull();
    });
    it('should throw an error if user does not exist', async () => {
      mockPrismaService.user.delete.mockRejectedValueOnce(
        'User to delete not found',
      );
      try {
        await service.remove(mockUserId);
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
        where: { id: mockUserId },
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
      mockPrismaService.user.update.mockRejectedValueOnce(
        new Error('DB error'),
      );

      await expect(
        service.createPasswordResetToken(mockUserId),
      ).rejects.toThrow(
        new CustomAPIError('Password reset token could not be created.'),
      );
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
        userid: mockUserId,
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
        userid: mockUserId,
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
          id: mockUserId2,
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
        userid: mockUserId,
        token: 'token',
        expires_at: new Date(currentDateTime + 10 * 60 * 1000), // token will expire 10 minutes later
      });

      mockPrismaService.user.findUnique.mockReturnValueOnce({
        name: 'test user',
        id: mockUserId,
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
        userid: mockUserId,
        token: 'token',
        expires_at: new Date(currentDateTime + 10 * 60 * 1000), // token will expire 10 minutes later
      });

      mockPrismaService.user.findUnique.mockReturnValueOnce({
        name: 'test user',
        id: mockUserId,
        email: 'testuser@email.com',
        password: 'oldpassword',
        role: { id: 1, role_name: 'user' },
        is_active: true,
      });

      mockPrismaService.user.update.mockResolvedValueOnce({
        name: 'test user',
        userid: mockUserId,
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

      expect(updateSpy).toHaveBeenCalledWith(mockUserId, {
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
    it('should throw an error when db error occurs', async () => {
      mockPrismaService.password_reset_tokens.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(
        service.resetPassword(
          'testuser@email.com',
          null as string,
          'oldpassword',
        ),
      ).rejects.toThrow('Password could not be reset.');
    });
  });

  describe('checkUserWithPassword', () => {
    it('should throw error when unexpected db error occurs', async () => {
      mockPrismaService.user.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      await expect(
        service.checkUserWithPassword('testuser@email.com', 'password123'),
      ).rejects.toThrow('User password check failed.');
    });
    it('should throw error when user credentials are invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      try {
        await service.checkUserWithPassword('testuser@email.com', 'password');
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Invalid user credentials');
      }
    });

    it('should throw error when password is incorrect', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      jest.spyOn(HelperService, 'compareHash').mockResolvedValueOnce(false);
      try {
        await service.checkUserWithPassword('testuser@email.com', 'password');
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Invalid user credentials');
      }
    });

    it('should return user when credentials are correct', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: mockUserId,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      jest.spyOn(HelperService, 'compareHash').mockResolvedValueOnce(true);

      const result = await service.checkUserWithPassword(
        'testuser@email.com',
        'password123',
      );

      expect(result).toEqual(
        new UserDTO(mockUserId, 'test user', 'testuser@email.com', 'user'),
      );
    });
  });
});
