import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum } from '../common/role.enum';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

jest.spyOn(bcrypt, 'hash').mockImplementation((pass, salt) => 'hashedPassword');

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a user if email is not taken', async () => {
      const user: CreateUserDto = new CreateUserDto();
      user.name = 'test user';
      user.email = 'testuser@email.com';
      user.password = 'password123';

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);

      const result = await service.create(user, RoleEnum.User);

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
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(user.password, 10);

      expect(result).toEqual({ message: 'User registered successfully' });
    });

    it('should throw an error if email is already in use', async () => {
      const user = new CreateUserDto();
      user.name = 'new user';
      user.email = 'testuser@email.com';
      user.password = 'password123';

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
        await service.create(user, RoleEnum.User);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Email already in use');
      }
    });
  });

  describe('findAll', () => {
    it('should return empty array if  there is no users', async () => {
      mockPrismaService.user.findMany.mockResolvedValueOnce(null);

      expect(await service.findAll()).toEqual([]);
    });

    it('should return all users', async () => {
      mockPrismaService.user.findMany.mockResolvedValueOnce([
        {
          id: 1,
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
          id: 1,
          name: 'test user',
          email: 'testuser@email.com',
          role: {
            id: 1,
            role_name: 'user',
          },
          is_active: true,
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
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
        cart: null,
      });

      const user = await service.findOne(1);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          id: 1,
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
          cart: true,
        },
      });

      expect(user).toEqual({
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
        cart: null,
      });
    });

    it('should throw an error if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne(999)).rejects.toThrow(
        new Error('User not found.'),
      );
    });
  });

  describe('findBy', () => {
    it('should return a user by email', async () => {
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

      const user = await service.findBy('testuser@email.com');

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
    });

    it('should throw an error if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.findBy('invaliduser@email.com')).rejects.toThrow(
        new Error('User not found.'),
      );
    });
  });

  describe('update', () => {
    it('should successfully update a user', async () => {
      const updatedUserDto: UpdateUserDto = {
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
      };

      mockPrismaService.user.update.mockResolvedValueOnce({
        id: 1,
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      const result = await service.update(1, updatedUserDto);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'updated test user',
          email: 'updatedtestuser@email.com',
          password: 'hashedPassword',
        },
      });

      expect(result).toEqual({ message: 'User updated successfully' });
    });

    it('should throw an error if user does not exist', async () => {
      const user: UpdateUserDto = {
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
      };

      mockPrismaService.user.update.mockRejectedValueOnce(
        'User to update not found',
      );

      try {
        await service.update(999, user);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('User could not be updated');
      }
    });

    it('should throw an error if no changes provided', async () => {
      try {
        await service.update(999, {});
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('User could not be updated');
      }
    });
  });

  describe('remove', () => {
    it('should successfully delete a user', async () => {
      mockPrismaService.user.delete.mockResolvedValueOnce({
        id: 1,
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
        role: {
          id: 1,
          role_name: 'user',
        },
        is_active: true,
      });

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'User deleted successfully' });

      await expect(service.findOne(1)).rejects.toThrow(
        new Error('User not found.'),
      );
    });
    it('should throw an error if user does not exist', async () => {
      mockPrismaService.user.delete.mockRejectedValueOnce(
        'User to delete not found',
      );
      try {
        await service.remove(1);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('User could not be deleted');
      }
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create and return a disposable token', async () => {
      const mockUserId = 1;
      const mockToken = 'mock-uuid-token';

      (uuidv4 as jest.Mock).mockReturnValue(mockToken);

      mockPrismaService.user.update.mockResolvedValueOnce({});

      const result = await service.createPasswordResetToken(mockUserId);

      expect(uuidv4).toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          password_reset_tokens: {
            create: {
              token: mockToken,
              expires_at: expect.any(Date),
            },
          },
        },
      });
      expect(result).toBe(mockToken);
    });

    it('should throw an error if Prisma update fails', async () => {
      const mockUserId = 1;

      (uuidv4 as jest.Mock).mockReturnValue('mock-uuid-token');

      mockPrismaService.user.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createPasswordResetToken(mockUserId),
      ).rejects.toThrow('Password reset token could not be created.');
    });
  });
});
