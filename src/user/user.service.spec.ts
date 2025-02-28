import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

      const result = await service.create(user);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: 'test user',
          email: 'testuser@email.com',
          password: 'password123',
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
        roleid: 1,
        is_active: true,
      });

      try {
        await service.create(user);
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
          password: 'password123',
          roleid: 1,
          is_active: true,
        },
      ]);

      expect(await service.findAll()).toEqual([
        {
          id: 1,
          name: 'test user',
          email: 'testuser@email.com',
          password: 'password123',
          roleid: 1,
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
        roleid: 1,
        is_active: true,
      });

      const user = await service.findOne(1);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
      });

      expect(user).toEqual({
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        roleid: 1,
        is_active: true,
      });
    });

    it('should return null an error if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      expect(await service.findOne(999)).toBeNull();
    });
  });

  describe('findBy', () => {
    it('should return a user by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        roleid: 1,
        is_active: true,
      });

      const user = await service.findBy('testuser@email.com');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: 'testuser@email.com',
        },
      });

      expect(user).toEqual({
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        roleid: 1,
        is_active: true,
      });
    });

    it('should return null if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      expect(await service.findBy('invaliduser@email.com')).toBeNull();
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
        password: 'newpassword123',
        roleid: 1,
        is_active: true,
      });

      const result = await service.update(1, updatedUserDto);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'updated test user',
          email: 'updatedtestuser@email.com',
          password: 'newpassword123',
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
  });

  describe('remove', () => {
    it('should successfully delete a user', async () => {
      mockPrismaService.user.delete.mockResolvedValueOnce({
        id: 1,
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
        roleid: 1,
        is_active: true,
      });

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'User deleted successfully' });

      expect(await service.findOne(1)).toBeNull();
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
});
